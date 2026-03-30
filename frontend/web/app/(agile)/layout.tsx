import React, { Suspense } from "react";
import Sidebar from "../nav/Sidebar";
import TopBar from "../nav/TopBar";

export default function AgileLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="flex h-screen bg-[#F1F6F9]">
			<Sidebar />
			<div className="flex flex-1 flex-col overflow-hidden">
				<Suspense fallback={<div className="h-[119px] bg-[#F1F6F9]" />}>
					<TopBar />
				</Suspense>
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F1F6F9] p-6">
					<div className="max-w-[1272px] mx-auto">{children}</div>
				</main>
			</div>
		</div>
	);
}
