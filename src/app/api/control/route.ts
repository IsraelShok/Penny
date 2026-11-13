import {currentUser} from "@/server/lib/user-access";
import { NextResponse } from "next/server";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { controlCommand,controlPayload } from "@/server/db/queries/financial-control";
export async function GET(request:Request) {try{return NextResponse.json(controlPayload(getWorkspaceIdFromRequest(request),new URL(request.url).searchParams.get("month")??undefined));}catch(error){console.error("[control] Load failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"Unable to load financial controls"},{status:400});}}
export async function POST(request:Request) {const body=await request.json().catch(()=>null);if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid command"},{status:400});try{return NextResponse.json(controlCommand(getWorkspaceIdFromRequest(request),body,currentUser(request)?.id??null));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save"},{status:400});}}
