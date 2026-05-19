export interface ImageAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface ProjectBase {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  coverImage: ImageAsset;
  aspectRatio: string;
}

export interface CodeProject extends ProjectBase {
  type: "code";
  repo?: string;
  liveUrl?: string;
  techStack: string[];
}

export interface TextileProject extends ProjectBase {
  type: "textile";
  materials: string[];
  techniques: string[];
  gallery?: ImageAsset[];
  dimensions?: string;
}

export type Project = CodeProject | TextileProject;
