export interface MetaTag {
  name?: string;
  property?: string;
  httpEquiv?: string;
  charset?: string;
  content?: string;
}

export interface LinkTag {
  rels: string[];
  href?: string;
  hreflang?: string;
  type?: string;
  sizes?: string;
}

export interface Icon {
  href: string;
  rel: string;
  type?: string;
  sizes?: string;
}

export interface Alternate {
  href: string;
  hreflang?: string;
  type?: string;
  title?: string;
}

export interface MetaExtractionResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType?: string;

  // Normalized fields
  lang?: string;
  title?: string;
  description?: string;
  canonical?: string;
  charset?: string;
  themeColor?: string;
  author?: string;
  keywords?: string;
  robots?: string;
  generator?: string;
  favicon?: string;

  // Structured normalized fields
  icons: Icon[];
  alternates: Alternate[];

  // OG/Twitter
  og: Record<string, string>;
  twitter: Record<string, string>;

  // Raw collections
  metaByName: Record<string, string>;
  metaByProperty: Record<string, string>;
  metaTags: MetaTag[];
  linkTags: LinkTag[];
}

export interface NonHtmlResponse {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType?: string;
  error: "non-html response";
}

export type PageMetaResult = MetaExtractionResult | NonHtmlResponse;
