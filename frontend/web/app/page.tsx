'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import styles from './page.module.css';

// --- ICONS ---

function IconLogo() {
  return (
    <svg className="size-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IconSmart() {
  return (
    <svg className="size-full" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function IconTimeline() {
  return (
    <svg className="size-full" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg className="size-full" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

// --- COMPONENTS ---

function LogoContainer() {
  return (
    <div className="h-[40px] relative shrink-0 w-[139.344px]">
      <div className="flex gap-[12px] items-center relative size-full">
        <div className="bg-white relative rounded-[10px] shrink-0 size-[40px] flex items-center justify-center p-2 text-blue-600">
           <IconLogo />
        </div>
        <div className="flex-[1_0_0] h-[31px] relative">
            <p className="font-sans font-bold leading-[28px] text-[20px] text-white">Planora</p>
        </div>
      </div>
    </div>
  );
}

function NavButtons() {
  return (
    <div className="h-[36px] relative shrink-0 w-[240px] flex gap-[12px] items-center">
        <Link href="/login">
            <div className="h-[36px] rounded-[8px] shrink-0 w-[90px] cursor-pointer flex items-center justify-center hover:bg-white/10 transition-colors">
                <p className="font-medium text-[14px] text-white">Sign In</p>
            </div>
        </Link>
        <Link href="/register" className="w-full">
            <div className="bg-white h-[36px] rounded-[8px] shadow-md cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center px-4 w-full">
                <p className="font-medium text-[#1d56d5] text-[14px]">Get Started</p>
            </div>
        </Link>
    </div>
  );
}

function Navigation() {
  return (
    <div className="bg-white/10 flex flex-col h-[73px] items-start pb-px relative shrink-0 w-full border-b border-white/20">
      <div className="h-[72px] relative shrink-0 w-full flex items-center justify-between px-[24px]">
          <LogoContainer />
          <NavButtons />
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <div className="relative w-full flex flex-col items-center pt-10 px-4">
      {/* Badge */}
      <div className={styles.heroBadge}>
        <p className="font-medium text-[12px] text-white">✨ The Future of Project Management</p>
      </div>

      <h1 className="font-bold text-[36px] md:text-[56px] leading-tight md:leading-[68px] text-center text-white mb-5">
        Manage Projects <br/> with Planora
      </h1>

      <p className="text-[15px] md:text-[16px] leading-[26px] text-white/90 text-center max-w-2xl mb-8">
        The all-in-one project management platform that helps teams plan, track, and deliver exceptional work. Streamline your workflow and boost productivity.
      </p>

      <div className="flex flex-col sm:flex-row gap-[10px] items-center justify-center mb-16">
    
    {/* Primary: Get Started */}
    <Link href="/register">
        <div className="bg-white h-[40px] rounded-[10px] shadow-lg px-5 cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group">
            <p className="font-semibold text-[#1d56d5] text-[14px]">Get Started</p>
            <svg className="w-3.5 h-3.5 text-[#1d56d5] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
        </div>
    </Link>

    {/* Secondary: Learn More */}
    <a href="#features">
        <div className="bg-white/10 h-[40px] rounded-[10px] border border-white/30 px-5 cursor-pointer hover:bg-white/20 transition-colors flex items-center justify-center backdrop-blur-sm gap-2">
            <p className="font-medium text-white text-[14px]">Learn More</p>
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </a>
</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <div className={styles.glassCard}>
      <div className="bg-white/20 rounded-[12px] size-[44px] flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-[17px] text-white mb-2">{title}</h3>
      <p className="text-[13px] leading-[20px] text-white/80">{desc}</p>
    </div>
  );
}

function FeaturesGrid() {
  return (
    // Added ID for smooth scrolling
    <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-[24px] max-w-5xl mx-auto px-4 pb-16 scroll-mt-20">
      <FeatureCard 
        icon={<IconSmart />}
        title="Smart Backlogs"
        desc="Organize your work with intelligent backlogs, sprints, and task management."
      />
      <FeatureCard 
        icon={<IconTimeline />}
        title="Timeline & Calendar"
        desc="Visualize your project timeline and schedule. Track deadlines and milestones."
      />
      <FeatureCard 
        icon={<IconTeam />}
        title="Team Collaboration"
        desc="Built-in chat, pages, and real-time updates keep everyone connected."
      />
    </div>
  );
}

export default function Page() {
  return (
    <div className={styles.mainContainer}>
      <Navigation />
      <HeroSection />
      <FeaturesGrid />
    </div>
  );
}