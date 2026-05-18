import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ReviewCard {
  id: string;
  topicName: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all topics for this project
  const { data: topics } = await serviceSupabase
    .from("topics")
    .select("id, name")
    .eq("project_id", projectId);

  if (!topics?.length) return NextResponse.json({ cards: [] });

  const topicIds = topics.map((t: any) => t.id);
  const topicMap = new Map(topics.map((t: any) => [t.id, t.name]));

  // Fetch wrong answers across all topics (most recent 40, shuffle client-side)
  const { data: wrong } = await serviceSupabase
    .from("wrong_answers")
    .select("id, topic_id, question, user_answer, correct_answer")
    .in("topic_id", topicIds)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!wrong?.length) return NextResponse.json({ cards: [] });

  const cards: ReviewCard[] = wrong.map((w: any) => ({
    id: w.id,
    topicName: topicMap.get(w.topic_id) ?? "Unknown",
    question: w.question,
    userAnswer: w.user_answer,
    correctAnswer: w.correct_answer,
  }));

  // Fisher-Yates shuffle so review order is randomised
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return NextResponse.json({ cards });
}
