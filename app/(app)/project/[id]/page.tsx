import { notFound } from 'next/navigation'
import { getProject } from '@/lib/db/projects'
import { getTopics, getTopicEdges } from '@/lib/db/topics'
import { getResources } from '@/lib/db/resources'
import { ProjectPageClient } from './ProjectPageClient'

interface Props { params: Promise<{ id: string }> }

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const [project, topics, resources] = await Promise.all([
    getProject(id),
    getTopics(id),
    getResources(id),
  ])
  if (!project) notFound()
  const edges = await getTopicEdges(id)
  return (
    <ProjectPageClient
      project={project}
      topics={topics}
      edges={edges}
      initialResources={resources}
    />
  )
}
