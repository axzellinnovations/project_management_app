'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';

export default function KanbanProjectPage() {
    const [projectName, setProjectName] = useState('');
    const [projectKey, setProjectKey] = useState('');
    const [description, setDescription] = useState('');
    const [teamOption, setTeamOption] = useState<'NEW' | 'EXISTING'>('NEW');
    const [teamName, setTeamName] = useState('');

    const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
    const [serverError, setServerError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Validation states
    const [isKeyValid, setIsKeyValid] = useState<boolean | null>(null);
    const [isTeamValid, setIsTeamValid] = useState<boolean | null>(null);
    const [checkingKey, setCheckingKey] = useState(false);
    const [checkingTeam, setCheckingTeam] = useState(false);

    const router = useRouter();

    // Debounce Project Key Check
    useEffect(() => {
        const checkKey = async () => {
            if (projectKey.trim().length < 3) {
                setIsKeyValid(null);
                return;
            }
            setCheckingKey(true);
            try {
                const res = await api.get(`/api/projects/check-key?key=${projectKey.trim()}`);
                setIsKeyValid(res.data); // true if available
            } catch (err) {
                console.error("Key check error:", err);
                setIsKeyValid(null);
            } finally {
                setCheckingKey(false);
            }
        };

        const timer = setTimeout(checkKey, 500);
        return () => clearTimeout(timer);
    }, [projectKey]);

    // Debounce Team Name Check
    useEffect(() => {
        const checkTeam = async () => {
            if (teamName.trim().length === 0) {
                setIsTeamValid(null);
                return;
            }
            setCheckingTeam(true);
            try {
                const res = await api.get(`/api/teams/check-name?name=${teamName.trim()}`);
                const { exists, isMember } = res.data;
                if (teamOption === 'NEW') {
                    setIsTeamValid(!exists);
                } else {
                    setIsTeamValid(exists && isMember);
                }
            } catch (err) {
                console.error("Team check error:", err);
                setIsTeamValid(null);
            } finally {
                setCheckingTeam(false);
            }
        };

        const timer = setTimeout(checkTeam, 500);
        return () => clearTimeout(timer);
    }, [teamName, teamOption]);

    const handleContinue = async (e: React.MouseEvent) => {
        e.preventDefault();
        setServerError(null);
        const newErrors: { [key: string]: boolean } = {};

        if (!projectName.trim()) newErrors.projectName = true;
        if (!projectKey.trim() || isKeyValid === false) newErrors.projectKey = true;
        if (!teamName.trim() || isTeamValid === false) newErrors.teamName = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setLoading(true);
            const res = await api.post('/api/projects', {
                name: projectName,
                projectKey: projectKey,
                description: description,
                teamOption: teamOption,
                teamName: teamName,
                type: 'KANBAN'
            });

            if (typeof window !== 'undefined') {
                localStorage.setItem('currentProjectName', projectName);
                localStorage.setItem('currentProjectId', res.data.id.toString());
                localStorage.setItem('currentProjectKey', projectKey);
            }

            if (teamOption === 'EXISTING') {
                router.push(`/summary/${res.data.id}`);
            } else {
                router.push(`/createProject/inviteMembers?projectId=${res.data.id}&projectKey=${projectKey}`);
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            const msg = err.response?.data?.message || err.response?.data || 'Failed to create project';
            setServerError(String(msg));
        } finally {
            setLoading(false);
        }
    };

    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setProjectName(name);

        if (!projectKey || projectKey === name.slice(0, projectKey.length).toUpperCase().replace(/\s+/g, '_')) {
            const generatedKey = name.replace(/\s+/g, '_').slice(0, 4).toUpperCase();
            setProjectKey(generatedKey);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center py-4 px-4 overflow-hidden bg-[#F5F5F7] selection:bg-[#1D56D5] selection:text-white">
            {/* Ambient Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#3B82F6]/30 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#8B5CF6]/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-[#10B981]/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-[1000px]">
                <div className="text-center mb-4">
                    <h1 className="font-outfit font-bold text-[28px] leading-[36px] text-[#1D1D1F] mb-1 tracking-tight">
                        Set Up Your Project
                    </h1>
                    <p className="font-inter text-[16px] leading-[24px] text-[#86868B]">
                        Tell us about your project to get started
                    </p>
                </div>

                <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/50 p-6 md:p-8">
                    {serverError && (
                        <div className="mb-4 p-4 bg-[#FEF3F2]/80 backdrop-blur-sm border border-[#FECDCA] text-[#B42318] rounded-[14px] font-inter text-[14px]">
                            {serverError}
                        </div>
                    )}
                    <form className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Left Column: Project Details */}
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="font-inter font-medium text-[14px] text-[#1D1D1F] flex items-center gap-1">
                                    Project Name <span className="text-[#FF3B30]">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., Support Kanban"
                                    value={projectName}
                                    onChange={(e) => {
                                        handleProjectNameChange(e);
                                        if (errors.projectName) setErrors({ ...errors, projectName: false });
                                    }}
                                    className={`w-full h-[44px] bg-white/50 border ${errors.projectName ? 'border-[#FF3B30]' : 'border-white/60 hover:border-[#D1D5DC]'} rounded-[14px] px-4 font-inter text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#1D56D5]/10 focus:border-[#1D56D5]`}
                                />
                                {errors.projectName && <span className="text-[#FF3B30] text-[12px] font-inter mt-1">Project Name is required</span>}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-inter font-medium text-[14px] text-[#1D1D1F] flex items-center gap-1">
                                    Project Key <span className="text-[#FF3B30]">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., SUP"
                                    value={projectKey}
                                    onChange={(e) => {
                                        setProjectKey(e.target.value.toUpperCase().replace(/\s/g, '_'));
                                        if (errors.projectKey) setErrors({ ...errors, projectKey: false });
                                    }}
                                    className={`w-full h-[44px] bg-white/50 border ${errors.projectKey || isKeyValid === false ? 'border-[#FF3B30]' : isKeyValid ? 'border-[#34C759]' : 'border-white/60 hover:border-[#D1D5DC]'} rounded-[14px] px-4 font-inter text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#1D56D5]/10 focus:border-[#1D56D5] uppercase`}
                                />
                                <div className="flex justify-between items-center px-1 mt-1">
                                    <p className="font-inter text-[12px] text-[#86868B]">
                                        A short identifier for your project
                                    </p>
                                    <div className="flex items-center gap-1">
                                        {checkingKey && <span className="text-[#86868B] text-[12px] font-inter">Checking...</span>}
                                        {isKeyValid === true && <span className="text-[#34C759] text-[12px] font-inter font-medium">Available</span>}
                                        {isKeyValid === false && !checkingKey && <span className="text-[#FF3B30] text-[12px] font-inter font-medium">Already in use</span>}
                                        {errors.projectKey && isKeyValid !== false && <span className="text-[#FF3B30] text-[12px] font-inter">Required</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-inter font-medium text-[14px] text-[#1D1D1F]">
                                    Description
                                </label>
                                <textarea
                                    placeholder="Describe your project and its goals..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full h-[80px] bg-white/50 border border-white/60 hover:border-[#D1D5DC] rounded-[14px] p-4 font-inter text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#1D56D5]/10 focus:border-[#1D56D5] resize-none"
                                />
                            </div>
                        </div>

                        {/* Right Column: Team & Board Setup */}
                        <div className="flex flex-col gap-4 h-full">
                            <div className="flex flex-col gap-2">
                                <label className="font-inter font-medium text-[14px] text-[#1D1D1F]">
                                    Team Setup <span className="text-[#FF3B30]">*</span>
                                </label>
                                <div className="flex gap-4 p-1">
                                    <label className="flex items-center gap-2 cursor-pointer font-inter text-[14px] text-[#1D1D1F] group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="radio"
                                                name="teamOption"
                                                value="NEW"
                                                checked={teamOption === 'NEW'}
                                                onChange={() => { setTeamOption('NEW'); setIsTeamValid(null); setTeamName(''); }}
                                                className="peer appearance-none w-5 h-5 border-2 border-[#D1D5DC] rounded-full checked:border-[#1D56D5] transition-colors"
                                            />
                                            <div className="absolute w-2.5 h-2.5 bg-[#1D56D5] rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                                        </div>
                                        Create New Team
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer font-inter text-[14px] text-[#1D1D1F] group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="radio"
                                                name="teamOption"
                                                value="EXISTING"
                                                checked={teamOption === 'EXISTING'}
                                                onChange={() => { setTeamOption('EXISTING'); setIsTeamValid(null); setTeamName(''); }}
                                                className="peer appearance-none w-5 h-5 border-2 border-[#D1D5DC] rounded-full checked:border-[#1D56D5] transition-colors"
                                            />
                                            <div className="absolute w-2.5 h-2.5 bg-[#1D56D5] rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                                        </div>
                                        Use Existing Team
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-inter font-medium text-[14px] text-[#1D1D1F] flex items-center gap-1">
                                    Team Name <span className="text-[#FF3B30]">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={teamOption === 'NEW' ? "Enter new team name" : "Enter existing team name"}
                                    value={teamName}
                                    onChange={(e) => {
                                        setTeamName(e.target.value.replace(/\s/g, '_'));
                                        if (errors.teamName) setErrors({ ...errors, teamName: false });
                                    }}
                                    className={`w-full h-[48px] bg-white/50 border ${errors.teamName || isTeamValid === false ? 'border-[#FF3B30]' : isTeamValid ? 'border-[#34C759]' : 'border-white/60 hover:border-[#D1D5DC]'} rounded-[14px] px-4 font-inter text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#1D56D5]/10 focus:border-[#1D56D5]`}
                                />
                                <div className="flex items-center px-1 mt-1">
                                    {checkingTeam && <span className="text-[#86868B] text-[12px] font-inter">Checking...</span>}
                                    {isTeamValid === true && <span className="text-[#34C759] text-[12px] font-inter font-medium">{teamOption === 'NEW' ? 'Available' : 'Validated'}</span>}
                                    {isTeamValid === false && !checkingTeam && <span className="text-[#FF3B30] text-[12px] font-inter font-medium">{teamOption === 'NEW' ? 'Already exists' : 'Not found / Not member'}</span>}
                                    {errors.teamName && isTeamValid !== false && <span className="text-[#FF3B30] text-[12px] font-inter">Required</span>}
                                </div>
                            </div>

                            {/* Board Type Configurator */}
                            <div className="bg-white/40 border border-white/40 rounded-[14px] p-4 flex items-center gap-4 mt-2 shadow-sm backdrop-blur-md">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#1D56D5] to-[#4F46E5] rounded-[10px] flex items-center justify-center shrink-0 shadow-md">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 22h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2Z" />
                                        <path d="M14 2v20" />
                                        <path d="M8 2v20" />
                                    </svg>
                                </div>
                                <div className="flex-grow">
                                    <p className="font-inter text-[12px] text-[#86868B] font-medium mb-0.5 uppercase tracking-wider">Methodology</p>
                                    <p className="font-outfit font-semibold text-[16px] text-[#1D1D1F]">Kanban Board</p>
                                </div>
                                <Link href="/createProject" className="font-inter text-[13px] font-medium text-[#1D56D5] px-3 py-1.5 bg-white/50 rounded-full hover:bg-white hover:shadow-sm transition-all">
                                    Change
                                </Link>
                            </div>

                            {/* Spacer block to push buttons to bottom logically aligned */}
                            <div className="flex-grow mt-6"></div>

                            {/* Action Buttons */}
                            <div className="flex gap-4">
                                <Link href="/createProject" className="w-[120px] h-[48px] bg-white/50 border border-white/60 rounded-[14px] flex items-center justify-center font-inter font-medium text-[15px] text-[#1D1D1F] hover:bg-white hover:shadow-sm transition-all">
                                    Back
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleContinue}
                                    disabled={loading || isKeyValid === false || isTeamValid === false}
                                    className={`flex-1 h-[48px] rounded-[14px] flex items-center justify-center font-inter font-medium text-[15px] text-white shadow-md transition-all ${loading || isKeyValid === false || isTeamValid === false ? 'bg-[#1D56D5]/60 cursor-not-allowed shadow-none' : 'bg-[#1D56D5] hover:bg-[#1642B5] hover:shadow-lg'}`}
                                >
                                    {loading ? 'Processing...' : 'Continue to next step'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
                <div className="mt-8 text-center text-[#86868B] font-inter text-[13px]">
                    © 2025 Planora. All rights reserved.
                </div>
            </div>
        </div>
    );
}
