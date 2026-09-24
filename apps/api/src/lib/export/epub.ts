// EPUB Generator using JSZip (works in Cloudflare Workers)
// EPUB is a ZIP file containing XHTML files + metadata
import JSZip from 'jszip';
import { tiptapToHtml, type ExportChapter, type ExportProject } from './utils';

export interface EpubOptions {
  includeFrontMatter?: boolean;
  includeToc?: boolean;
  authorName?: string;
  language?: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function generateContentOpf(
  project: ExportProject,
  chapters: ExportChapter[],
  authorName: string,
  language: string,
  includeFrontMatter: boolean,
  includeToc: boolean
): string {
  const uuid = `urn:uuid:${project.id}`;
  const now = new Date().toISOString();

  let manifest = '';
  let spine = '';

  if (includeFrontMatter) {
    manifest += `    <item id="frontmatter" href="frontmatter.xhtml" media-type="application/xhtml+xml"/>\n`;
    spine += `    <itemref idref="frontmatter"/>\n`;
  }

  if (includeToc) {
    manifest += `    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml"/>\n`;
    spine += `    <itemref idref="toc"/>\n`;
  }

  chapters.forEach((_, idx) => {
    manifest += `    <item id="chapter${idx + 1}" href="chapter${idx + 1}.xhtml" media-type="application/xhtml+xml"/>\n`;
    spine += `    <itemref idref="chapter${idx + 1}"/>\n`;
  });

  manifest += `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n`;
  manifest += `    <item id="style" href="style.css" media-type="text/css"/>\n`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(project.title)}</dc:title>
    <dc:creator opf:role="aut">${escapeXml(authorName)}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:identifier id="uuid" opf:scheme="uuid">${uuid}</dc:identifier>
    <dc:description>${escapeXml(project.description || '')}</dc:description>
    <dc:subject>${escapeXml(project.genre || '')}</dc:subject>
    <dc:date>${now}</dc:date>
    <meta name="cover" content="cover"/>
  </metadata>
  <manifest>
${manifest}  </manifest>
  <spine toc="ncx">
${spine}  </spine>
  <guide>
    <reference type="toc" title="Mục lục" href="toc.xhtml"/>
    <reference type="text" title="Bắt đầu đọc" href="chapter1.xhtml"/>
  </guide>
</package>`;
}

function generateTocNcx(
  project: ExportProject,
  chapters: ExportChapter[],
  includeFrontMatter: boolean,
  includeToc: boolean
): string {
  let navPoints = '';
  let playOrder = 1;

  if (includeFrontMatter) {
    navPoints += `    <navPoint id="frontmatter" playOrder="${playOrder++}">
      <navLabel><text>Trang bìa</text></navLabel>
      <content src="frontmatter.xhtml"/>
    </navPoint>\n`;
  }

  if (includeToc) {
    navPoints += `    <navPoint id="toc" playOrder="${playOrder++}">
      <navLabel><text>Mục lục</text></navLabel>
      <content src="toc.xhtml"/>
    </navPoint>\n`;
  }

  chapters.forEach((ch, idx) => {
    navPoints += `    <navPoint id="chapter${idx + 1}" playOrder="${playOrder++}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="chapter${idx + 1}.xhtml"/>
    </navPoint>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${project.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(project.title)}</text></docTitle>
  <navMap>
${navPoints}  </navMap>
</ncx>`;
}

function generateStyleCss(): string {
  return `
body {
  font-family: "Times New Roman", serif;
  line-height: 1.6;
  margin: 1em;
  color: #333;
}

h1 {
  font-size: 2em;
  text-align: center;
  margin: 1em 0;
  color: #2E5090;
  page-break-before: always;
}

h2 {
  font-size: 1.5em;
  margin: 1em 0 0.5em 0;
  color: #333;
}

h3 {
  font-size: 1.2em;
  margin: 0.8em 0 0.4em 0;
}

p {
  text-indent: 1.5em;
  margin: 0.5em 0;
  text-align: justify;
}

.title-page {
  text-align: center;
  margin-top: 30%;
}

.title-page h1 {
  font-size: 2.5em;
  margin-bottom: 0.2em;
  page-break-before: avoid;
}

.title-page h2 {
  font-size: 1.5em;
  color: #666;
  font-weight: normal;
  text-align: center;
}

.toc ul {
  list-style: none;
  padding: 0;
}

.toc li {
  margin: 0.5em 0;
  text-indent: 0;
}

.toc a {
  text-decoration: none;
  color: #2E5090;
}

.chapter-number {
  text-align: center;
  font-size: 0.9em;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5em;
  text-indent: 0;
}

blockquote {
  margin: 1em 2em;
  font-style: italic;
  color: #555;
  border-left: 3px solid #ccc;
  padding-left: 1em;
  text-indent: 0;
}

hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 2em 0;
}
`;
}

function generateFrontMatterXhtml(project: ExportProject, authorName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(project.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="title-page">
    <h1>${escapeXml(project.title)}</h1>
    ${project.subtitle ? `<h2>${escapeXml(project.subtitle)}</h2>` : ''}
    <p style="margin-top: 3em; font-size: 1.2em;">${escapeXml(authorName)}</p>
    ${project.genre ? `<p style="margin-top: 1em; color: #888;"><em>${escapeXml(project.genre)}</em></p>` : ''}
  </div>
  ${project.description ? `<div style="margin-top: 5em; text-align: center; font-style: italic;"><p>${escapeXml(project.description)}</p></div>` : ''}
</body>
</html>`;
}

function generateTocXhtml(project: ExportProject, chapters: ExportChapter[]): string {
  let tocItems = '';
  chapters.forEach((ch, idx) => {
    tocItems += `    <li><a href="chapter${idx + 1}.xhtml">Chương ${idx + 1}: ${escapeXml(ch.title)}</a></li>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Mục lục - ${escapeXml(project.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="toc">
    <h1>Mục lục</h1>
    <ul>
${tocItems}    </ul>
  </div>
</body>
</html>`;
}

function generateChapterXhtml(chapter: ExportChapter, index: number): string {
  const htmlContent = tiptapToHtml(chapter.content);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="chapter">
    <p class="chapter-number">Chương ${index + 1}</p>
    <h1>${escapeXml(chapter.title)}</h1>
    ${htmlContent}
  </div>
</body>
</html>`;
}

export async function generateEpub(
  project: ExportProject,
  chapters: ExportChapter[],
  options: EpubOptions = {}
): Promise<Uint8Array> {
  const {
    includeFrontMatter = true,
    includeToc = true,
    authorName = project.authorName || 'Tác giả',
    language = 'vi'
  } = options;

  const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);

  const zip = new JSZip();

  // mimetype must be first and uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF/container.xml
  zip.folder('META-INF')?.file('container.xml', generateContainerXml());

  // OEBPS/
  const oebps = zip.folder('OEBPS');
  if (!oebps) throw new Error('Failed to create OEBPS folder');

  oebps.file('content.opf', generateContentOpf(project, sortedChapters, authorName, language, includeFrontMatter, includeToc));
  oebps.file('toc.ncx', generateTocNcx(project, sortedChapters, includeFrontMatter, includeToc));
  oebps.file('style.css', generateStyleCss());

  if (includeFrontMatter) {
    oebps.file('frontmatter.xhtml', generateFrontMatterXhtml(project, authorName));
  }

  if (includeToc) {
    oebps.file('toc.xhtml', generateTocXhtml(project, sortedChapters));
  }

  sortedChapters.forEach((chapter, idx) => {
    oebps.file(`chapter${idx + 1}.xhtml`, generateChapterXhtml(chapter, idx));
  });

  const buffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return buffer;
}
