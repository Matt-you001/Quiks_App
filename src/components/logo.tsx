
import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("h-16 w-16 text-primary", className)}
            {...props}
        >
            <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2z" />
            <path d="M15.5 8.5 11 13H9.5a2.5 2.5 0 0 1 0-5H11l2 3" />
            <path d="m14 15.5 3-3" />
        </svg>
    )
}
