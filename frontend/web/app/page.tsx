'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserFromToken } from '@/lib/auth';
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
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function IconTimeline() {
  return (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

// --- REUSABLE COMPONENTS ---

type ButtonVariant = 'primary' | 'ghost' | 'outlined';
type ArrowType = 'arrow-right' | 'arrow-down';

interface ArrowIconProps {
  type: ArrowType;
  variant: ButtonVariant;
}

function ArrowIcon({ type, variant }: ArrowIconProps) {
  const color = variant === 'primary' ? 'text-[#1d56d5]' : 'text-white';
  const hoverTransform = type === 'arrow-right' ? 'group-hover:translate-x-1' : '';
  
  const paths = {
    'arrow-right': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />,
    'arrow-down': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  };
  
  return (
    <svg className={`w-3.5 h-3.5 ${color} ${hoverTransform} transition-transform`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {paths[type]}
    </svg>
  );
}

interface ButtonProps {
  variant?: ButtonVariant;
  href?: string;
  icon?: ArrowType;
  children: ReactNode;
  fullWidth?: boolean;
}

function Button({ variant = 'primary', href, icon, children, fullWidth = false }: ButtonProps) {
  const baseClasses = "h-11 sm:h-10 rounded-lg px-6 cursor-pointer transition-all flex items-center justify-center gap-2";
  
  const variantClasses = {
    primary: "bg-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 group",
    ghost: "hover:bg-white/10 transition-colors",
    outlined: "bg-white/10 border border-white/30 hover:bg-white/20 backdrop-blur-sm"
  };

  const textClasses = {
    primary: "font-semibold text-[#1d56d5] text-sm",
    ghost: "font-medium text-sm text-white whitespace-nowrap",
    outlined: "font-medium text-white text-sm"
  };

  const widthClass = fullWidth ? 'w-full sm:w-auto' : '';
  const heightClass = variant === 'ghost' ? 'h-9' : 'h-11 sm:h-10';
  
  const content = (
    <div className={`${baseClasses} ${heightClass} ${variantClasses[variant]} ${widthClass}`}>
      <p className={textClasses[variant]}>{children}</p>
      {icon && <ArrowIcon type={icon} variant={variant} />}
    </div>
  );

  return href ? <Link href={href} className={widthClass}>{content}</Link> : content;
}

interface IconContainerProps {
  children: ReactNode;
  variant?: 'solid' | 'glass';
}

function IconContainer({ children, variant = 'glass' }: IconContainerProps) {
  const classes = variant === 'solid'
    ? "bg-white relative rounded-lg shrink-0 w-9 h-9 flex items-center justify-center p-2 text-blue-600"
    : "bg-white/20 rounded-xl w-11 h-11 flex items-center justify-center mb-3";
    
  return <div className={classes}>{children}</div>;
}

// --- COMPONENTS ---

function LogoContainer() {
  return (
    <div className="flex gap-2.5 items-center">
        <IconContainer variant="solid">
           <IconLogo />
        </IconContainer>
        <p className="font-sans font-bold text-lg md:text-xl text-white">Planora</p>
    </div>
  );
}

function NavButtons() {
  return (
    <div className="flex gap-2 sm:gap-3 items-center">
        <Button variant="ghost" href="/login">Sign In</Button>
        <Button variant="primary" href="/register">Get Started</Button>
    </div>
  );
}

function Navigation() {
  return (
    <div className="bg-white/10 w-full border-b border-white/20">
      <div className="h-16 sm:h-[72px] w-full flex items-center justify-between px-4 sm:px-6 md:px-8">
          <LogoContainer />
          <NavButtons />
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <div className="relative w-full flex flex-col items-center pt-8 sm:pt-12 md:pt-16 px-4">
      {/* Badge */}
      <div className={styles.heroBadge}>
        <p className="font-medium text-xs text-white">✨ The Future of Project Management</p>
      </div>

      <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl lg:text-[56px] leading-tight text-center text-white mb-4 sm:mb-5">
        Manage Projects <br className="hidden sm:block"/> <span className="sm:hidden"> </span>with Planora
      </h1>

      <p className="text-sm sm:text-base md:text-[16px] leading-relaxed text-white/90 text-center max-w-2xl mb-8 px-2">
        The all-in-one project management platform that helps teams plan, track, and deliver exceptional work. Streamline your workflow and boost productivity.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center mb-12 sm:mb-16 w-full sm:w-auto px-4 sm:px-0">
        <Button variant="primary" href="/register" icon="arrow-right" fullWidth>
          Get Started
        </Button>
        <Button variant="outlined" href="#features" icon="arrow-down" fullWidth>
          Learn More
        </Button>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <div className={styles.glassCard}>
      <IconContainer variant="glass">
        {icon}
      </IconContainer>
      <h3 className="font-semibold text-base sm:text-[17px] text-white mb-2">{title}</h3>
      <p className="text-xs sm:text-[13px] leading-relaxed text-white/80">{desc}</p>
    </div>
  );
}

function FeaturesGrid() {
  return (
    // Added ID for smooth scrolling
    <div id="features" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16 scroll-mt-20">
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
  const router = useRouter();

  useEffect(() => {
    if (getUserFromToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className={styles.mainContainer}>
      <Navigation />
      <HeroSection />
      <FeaturesGrid />
    </div>
  );
}