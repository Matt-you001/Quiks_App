
import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="80"
            height="80"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-20 w-20", className)}
            {...props}
        >
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#00AEEF', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#2D3E9A', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="grad2" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#F7931E', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#FBB03B', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#2D3E9A', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#00AEEF', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="arrow" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#F7931E', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#FBB03B', stopOpacity: 1 }} />
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="40" fill="url(#grad1)" />
            <path d="M50 10 A 40 40 0 0 1 90 50" stroke="url(#grad3)" strokeWidth="20" fill="none" strokeLinecap="round" />
            <path d="M50 90 A 40 40 0 0 1 10 50" stroke="url(#grad2)" strokeWidth="20" fill="none" strokeLinecap="round" />
            
            <circle cx="50" cy="50" r="22" fill="none" stroke="white" strokeWidth="1" strokeDasharray="2 10.5" strokeDashoffset="1.5"/>

            <circle cx="50" cy="50" r="10" fill="none" stroke="#00AEEF" strokeWidth="2" />
            <line x1="50" y1="50" x2="50" y2="42" stroke="#00AEEF" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="50" y1="50" x2="55" y2="50" stroke="#00AEEF" strokeWidth="1.5" strokeLinecap="round"/>

            <path d="M25 75 L48 52 L42 58 L75 25 L52 48 L58 42 L25 75Z" fill="url(#arrow)" />
        </svg>
    )
}
