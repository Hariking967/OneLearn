'use client'
import { MeetTab } from '@/components/classroom/MeetTab'

interface Props {
  classroomId: string
  isTeacher: boolean
  currentUserId: string
  currentUserName: string
}

export function VideoMeetTab({ classroomId, isTeacher, currentUserId, currentUserName }: Props) {
  return (
    <MeetTab
      classroomId={classroomId}
      isTeacher={isTeacher}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
    />
  )
}
