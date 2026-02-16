import React from "react";

export default function AgileLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="min-h-screen bg-[#F1F6F9] p-6">
			<div className="max-w-[1272px] mx-auto">{children}</div>
		</div>
	);
}
