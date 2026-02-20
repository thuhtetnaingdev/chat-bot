import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'

export function SidebarFooter() {
  return (
    <div className="border-t p-3">
      <Button variant="ghost" className="w-full justify-start gap-2 px-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">User Profile</span>
      </Button>
    </div>
  )
}
