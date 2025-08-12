
import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-16 w-16", className)}
            {...props}
        >
            <path
                d="M32 58C46.3594 58 58 46.3594 58 32C58 17.6406 46.3594 6 32 6C17.6406 6 6 17.6406 6 32C6 46.3594 17.6406 58 32 58Z"
                className="fill-primary"
            />
            <path
                d="M33.9181 44.3438L36.4314 36.9375H28.8533L26.3399 44.3438H20.0714L30.9181 19.6562H37.0626L47.9093 44.3438H41.6407L39.1273 36.9375H33.9181ZM30.7093 32.5312H37.2751L33.9923 23.4688L30.7093 32.5312Z"
                className="fill-primary-foreground"
            />
        </svg>

    )
}
