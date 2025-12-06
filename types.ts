
export interface Video {
  title: string;
}

export interface ReactionData {
  reactionOccurs: boolean;
  equation: string;
  explanation: string;
  isUserCorrect: boolean | null;
  feedback: string;
  videos: Video[];
}
