import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// GitHub serves any user's avatar at https://github.com/<login>.png — no API
// call needed. Falls back to initials while loading or if the user is missing.
export function GhAvatar({
  login,
  size = 20,
  className
}: {
  login: string
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <Avatar className={cn(className)} style={{ height: size, width: size }}>
      <AvatarImage src={`https://github.com/${login}.png?size=${size * 2}`} alt={login} />
      <AvatarFallback className="text-[10px]">{login.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
