
export interface Video {
  title: string;
}

export interface ImageInfo {
  url: string;
  alt: string;
}

export interface ReactionData {
  reactionOccurs: boolean;
  equation: string;
  explanation: string;
  isUserCorrect: boolean | null;
  feedback: string;
  videos: Video[];
  imageData?: ImageInfo | null;
}
