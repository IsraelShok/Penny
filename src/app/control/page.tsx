import {AppShell,PageHeader} from "@/components/layout/app-shell";
import {FinancialControl} from "@/components/control/financial-control";
export default function ControlPage(){return <AppShell><PageHeader title="מרכז הכסף"/><div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8"><FinancialControl/></div></AppShell>;}
