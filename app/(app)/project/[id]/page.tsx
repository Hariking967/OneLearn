import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/db/projects'
import { getTopics, getTopicEdges } from '@/lib/db/topics'
import { getResources } from '@/lib/db/resources'
import { ProjectPageClient } from './ProjectPageClient'

interface Props { params: Promise<{ id: string }> }

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [project, topics, resources] = await Promise.all([
    getProject(id),
    getTopics(id),
    getResources(id),
  ])

  if (!project) notFound()
  const edges = await getTopicEdges(id)

  const { data: userTreeNodes } = user
    ? await supabase
        .from('user_tree_nodes')
        .select('*')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .order('position')
    : { data: [] }

  return (
    <ProjectPageClient
      project={project}
      topics={topics}
      edges={edges}
      initialResources={resources}
      isTeacher={true}
      pathMode={project.path_mode ?? 'ai'}
      userTreeNodes={userTreeNodes ?? []}
    />
  )
}
