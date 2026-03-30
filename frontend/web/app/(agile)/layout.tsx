import React from "react";
import Sidebar from "../nav/Sidebar";
import TopBar from "../nav/TopBar";

export default function AgileLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="flex h-screen bg-[#F1F6F9]">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<TopBar />
				<main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
					<div className="max-w-[1272px] mx-auto">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
