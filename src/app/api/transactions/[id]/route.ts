import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import {
  updateTransactionCategory,
  setTransactionKind,
  setTransactionNeedsReview,
  getTransactionContext,
  setTransactionTags,
  setTransactionOwner,
} from "@/server/db/queries/transactions";
import { getAppSettings } from "@/server/db/queries/settings";
import { isValidOwner, normalizeTag } from "@/lib/tags";
import { recordMerchantCategory } from "@/server/lib/merchant-memory";
import { recordCorrection } from "@/server/db/queries/category-corrections";
import { getAllCategories } from "@/server/db/queries/categories";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const PUT = handle(
  "transactions/[id]",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const workspaceId = getWorkspaceIdFromRequest(request);
    const { id } = await params;
    const body = ((await request.json().catch(() => null)) ?? {}) as { categoryId: number };

    if (!Number.isSafeInteger(body.categoryId) || body.categoryId <= 0) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const category = getAllCategories(workspaceId).find((c) => c.id === body.categoryId);
    if (!category) return NextResponse.json({ error: "Unknown category" }, { status: 400 });

    const numericId = Number(id);

    const before = getTransactionContext(workspaceId, numericId);
    updateTransactionCategory(workspaceId, numericId, body.categoryId, "user");
    setTransactionNeedsReview(workspaceId, numericId, false);

    if (before && (before.kind === "expense" || before.kind === "income")) {
      if (category.kind === "expense" || category.kind === "income") {
        recordMerchantCategory(
          workspaceId,
          before.description,
          body.categoryId,
          category.kind,
          "user",
        );

        // If the user just overrode an AI-set category, log it as a correction
        // so the categorizer learns not to repeat the mistake on similar merchants.
        if (
          before.categorySource === "ai" &&
          before.categoryId != null &&
          before.categoryId !== body.categoryId
        ) {
          recordCorrection(
            workspaceId,
            before.description,
            before.categoryId,
            body.categoryId,
            category.kind,
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  },
);

export const PATCH = handle(
  "transactions/[id]",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const workspaceId = getWorkspaceIdFromRequest(request);
    const { id } = await params;
    const body = ((await request.json().catch(() => null)) ?? {}) as {
      kind?: unknown;
      approve?: unknown;
      tags?: unknown;
      owner?: unknown;
    };

    const numericId = Number(id);

    if (body.tags !== undefined || body.owner !== undefined) {
      let tags: string[] | undefined;
      if (body.tags !== undefined) {
        if (!Array.isArray(body.tags) || body.tags.length > 20) {
          return NextResponse.json({ error: "tags must be a list of up to 20" }, { status: 400 });
        }
        const clean = body.tags.map(normalizeTag);
        if (clean.some((t) => t == null)) {
          return NextResponse.json({ error: "invalid tag" }, { status: 400 });
        }
        tags = [...new Set(clean as string[])];
      }
      if (body.owner !== undefined && body.owner !== null) {
        const memberIds = getAppSettings(workspaceId).household.members.map((m) => m.id);
        if (!isValidOwner(body.owner, memberIds)) {
          return NextResponse.json(
            { error: "owner must be a household member or shared" },
            { status: 400 },
          );
        }
      }
      const found =
        (tags === undefined || setTransactionTags(workspaceId, numericId, tags)) &&
        (body.owner === undefined ||
          setTransactionOwner(workspaceId, numericId, body.owner as string | null));
      return found
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // Undo for an approve: puts the row back in the review inbox (merchant memory stays).
    if (body.approve === false) {
      if (!getTransactionContext(workspaceId, numericId)) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      setTransactionNeedsReview(workspaceId, numericId, true);
      return NextResponse.json({ success: true });
    }

    if (body.approve === true) {
      const ctx = getTransactionContext(workspaceId, numericId);
      if (!ctx) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      setTransactionNeedsReview(workspaceId, numericId, false);
      if (ctx.categoryId != null && (ctx.kind === "expense" || ctx.kind === "income")) {
        const category = getAllCategories(workspaceId).find((c) => c.id === ctx.categoryId);
        if (category && (category.kind === "expense" || category.kind === "income")) {
          recordMerchantCategory(
            workspaceId,
            ctx.description,
            ctx.categoryId,
            category.kind,
            "approved-ai",
          );
        }
      }
      return NextResponse.json({ success: true });
    }

    if (body.kind !== "expense" && body.kind !== "income" && body.kind !== "transfer") {
      return NextResponse.json(
        { error: "kind must be 'expense', 'income', or 'transfer', or set approve:true" },
        { status: 400 },
      );
    }

    setTransactionKind(workspaceId, numericId, body.kind);

    return NextResponse.json({ success: true });
  },
);
