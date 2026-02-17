'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AgileProjectPage() {
    const [projectName, setProjectName] = useState('');
    const [projectKey, setProjectKey] = useState('');
    const [projectLead, setProjectLead] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
    const router = useRouter();

    const handleContinue = (e: React.MouseEvent) => {
        e.preventDefault();
        const newErrors: { [key: string]: boolean } = {};

        if (!projectName.trim()) newErrors.projectName = true;
        if (!projectKey.trim()) newErrors.projectKey = true;
        if (!projectLead.trim()) newErrors.projectLead = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Save project name to localStorage for TopBar display
        if (typeof window !== 'undefined') {
            localStorage.setItem('currentProjectName', projectName);
        }

        router.push('/createProject/inviteMembers');
    };

    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setProjectName(name);
        // Auto-generate key: uppercase, no spaces, max 10 chars
        if (!projectKey || projectKey === name.slice(0, 4).toUpperCase()) {
            const generatedKey = name.replace(/\s+/g, '').slice(0, 4).toUpperCase();
            setProjectKey(generatedKey);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#EFF6FF] via-[#FFFFFF] to-[#FAF5FF] flex flex-col items-center py-20 px-4">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-[#1D56D5] rounded-[14px] flex items-center justify-center mx-auto mb-6 relative">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M2 12h20" />
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                </div>
                <h1 className="font-outfit font-bold text-[36px] leading-[40px] text-[#101828] mb-3">
                    Set Up Your Project
                </h1>
                <p className="font-inter text-[18px] leading-[28px] text-[#4A5565]">
                    Tell us about your project to get started
                </p>
            </div>

            {/* Form Container */}
            <div className="w-full max-w-[768px] bg-white rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] border border-[#E5E7EB] p-8">
                <form className="flex flex-col gap-6">
                    {/* Project Name */}
                    <div className="flex flex-col gap-2">
                        <label className="font-inter font-medium text-[14px] text-[#364153] flex items-center gap-1">
                            Project Name <span className="text-[#FB2C36]">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., E-Commerce Platform"
                            value={projectName}
                            onChange={(e) => {
                                handleProjectNameChange(e);
                                if (errors.projectName) setErrors({ ...errors, projectName: false });
                            }}
                            className={`w-full h-[50px] border ${errors.projectName ? 'border-[#FB2C36]' : 'border-[#D1D5DC]'} rounded-[10px] px-4 font-inter text-[16px] text-[#0A0A0A] placeholder:text-[#6A7282] focus:outline-none focus:ring-2 focus:ring-[#1D56D5]/20 focus:border-[#1D56D5]`}
                        />
                        {errors.projectName && <span className="text-[#FB2C36] text-[12px] font-inter">Project Name is required</span>}
                    </div>

                    {/* Project Key */}
                    <div className="flex flex-col gap-2">
                        <label className="font-inter font-medium text-[14px] text-[#364153] flex items-center gap-1">
                            Project Key <span className="text-[#FB2C36]">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., ECOM"
                            value={projectKey}
                            onChange={(e) => {
                                setProjectKey(e.target.value.toUpperCase());
                                if (errors.projectKey) setErrors({ ...errors, projectKey: false });
                            }}
                            className={`w-full h-[50px] border ${errors.projectKey ? 'border-[#FB2C36]' : 'border-[#D1D5DC]'} rounded-[10px] px-4 font-inter text-[16px] text-[#0A0A0A] placeholder:text-[#6A7282] focus:outline-none focus:ring-2 focus:ring-[#1D56D5]/20 focus:border-[#1D56D5] uppercase`}
                        />
                        {errors.projectKey && <span className="text-[#FB2C36] text-[12px] font-inter">Project Key is required</span>}
                        <p className="font-inter text-[12px] text-[#6A7282]">
                            A short identifier for your project (2-10 characters)
                        </p>
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-2">
                        <label className="font-inter font-medium text-[14px] text-[#364153]">
                            Description
                        </label>
                        <textarea
                            placeholder="Describe your project and its goals..."
                            className="w-full h-[122px] border border-[#D1D5DC] rounded-[10px] p-4 font-inter text-[16px] text-[#0A0A0A] placeholder:text-[#6A7282] focus:outline-none focus:ring-2 focus:ring-[#1D56D5]/20 focus:border-[#1D56D5] resize-none"
                        />
                    </div>

                    {/* Project Lead */}
                    <div className="flex flex-col gap-2">
                        <label className="font-inter font-medium text-[14px] text-[#364153] flex items-center gap-1">
                            Project Lead <span className="text-[#FB2C36]">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={projectLead}
                            onChange={(e) => {
                                setProjectLead(e.target.value);
                                if (errors.projectLead) setErrors({ ...errors, projectLead: false });
                            }}
                            className={`w-full h-[50px] border ${errors.projectLead ? 'border-[#FB2C36]' : 'border-[#D1D5DC]'} rounded-[10px] px-4 font-inter text-[16px] text-[#0A0A0A] placeholder:text-[#6A7282] focus:outline-none focus:ring-2 focus:ring-[#1D56D5]/20 focus:border-[#1D56D5]`}
                        />
                        {errors.projectLead && <span className="text-[#FB2C36] text-[12px] font-inter">Project Lead is required</span>}
                    </div>

                    {/* Project Type Display */}
                    <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-[10px] p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1D56D5] rounded-[10px] flex items-center justify-center shrink-0">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v20M2 12h20" />
                                <circle cx="12" cy="12" r="10" />
                            </svg>
                        </div>
                        <div className="flex-grow">
                            <p className="font-inter text-[14px] text-[#4A5565] mb-0.5">Project Type</p>
                            <p className="font-inter font-medium text-[16px] text-[#101828]">Agile Scrum</p>
                        </div>
                        <Link href="/createProject" className="font-inter text-[14px] text-[#1D56D5] hover:underline">
                            Change
                        </Link>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-transparent">
                        <Link href="/createProject" className="flex-1 h-[50px] border border-[#D1D5DC] rounded-[10px] flex items-center justify-center font-inter font-medium text-[16px] text-[#364153] hover:bg-gray-50 transition-colors">
                            Back
                        </Link>
                        <button
                            type="button"
                            onClick={handleContinue}
                            className="flex-1 h-[50px] bg-[#1D56D5] rounded-[10px] flex items-center justify-center font-inter font-medium text-[16px] text-white hover:bg-blue-700 transition-colors"
                        >
                            Continue
                        </button>
                    </div>
                </form>
                <div className="mt-6 text-center text-[#4A5565] font-inter text-[14px]">
                    © 2025 Planora. All rights reserved.
                </div>
            </div>
        </div>
    );
}
