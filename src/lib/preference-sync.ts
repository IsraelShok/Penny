"use client";
import {getPreference,putPreference} from "./api";
import {getActiveProfileIdSync,getActiveWorkspaceIdSync} from "./workspace-store";
const revisions=new Map<string,number>();
const queues=new Map<string,Promise<unknown>>();
// Household keys are shared by all profiles (see /api/preferences), so their revision is too.
const owner=(key:string)=>key==="activation"?"household":getActiveProfileIdSync()??"local";
const identity=(key:string)=>`${getActiveWorkspaceIdSync()??"default"}:${owner(key)}:${key}`;
export async function loadPreference(key:string,workspaceId:number|null=getActiveWorkspaceIdSync()){const id=`${workspaceId??"default"}:${owner(key)}:${key}`,result=await getPreference(key,workspaceId);revisions.set(id,result.revision);return result.value;}
export function storePreference(key:string,value:unknown){const workspaceId=getActiveWorkspaceIdSync(),id=identity(key);const next=(queues.get(id)??Promise.resolve()).catch(()=>{}).then(async()=>{if(!revisions.has(id))await loadPreference(key,workspaceId);const result=await putPreference(key,value,revisions.get(id)!,workspaceId);revisions.set(id,result.revision);});queues.set(id,next);return next;}
