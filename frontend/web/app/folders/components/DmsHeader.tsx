'use client';

import { Upload } from 'lucide-react';

interface DmsHeaderProps {
    title: string;
    isTrashMode: boolean;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function DmsHeader({ title, isTrashMode, onUpload }: DmsHeaderProps) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8EC] bg-white">
            <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#667085]">Knowledge</p>
                <h1 className="text-[20px] font-semibold text-[#101828]">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
                {!isTrashMode && (
                    <label className="inline-flex items-center gap-2 bg-[#155DFC] hover:bg-[#004EEB] text-white px-4 py-2 rounded-md cursor-pointer text-sm font-medium">
                        <Upload size={16} />
                        Upload
                        <input type="file" className="hidden" onChange={onUpload} />
                    </label>
                )}
            </div>
        </div>
    );
}
