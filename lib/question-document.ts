import JSZip from "jszip";
import type { Question, QuestionImage } from "../types/app";

type Draft = {
  prompt: string;
  type: "objective" | "written";
  options: Array<{ key: string; text: string }>;
  answer: string;
  explanation: string;
  markingGuide: string;
  points: number;
  maxWords: number;
  image?: QuestionImage;
};

const decodeXml = (value: string) => value
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const cleanParagraphText = (xml: string) => decodeXml(
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("")
).trim();

function parseQuestionParagraphs(paragraphs: Array<{ text: string; image?: QuestionImage }>) {
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let pendingImage: QuestionImage | undefined;
  const finish = () => { if (current?.prompt) drafts.push(current); current = null; };
  const begin = (prompt: string) => {
    finish();
    current = { prompt, type: "objective", options: [], answer: "", explanation: "", markingGuide: "", points: 1, maxWords: 500, image: pendingImage };
    pendingImage = undefined;
  };

  for (const paragraph of paragraphs) {
    if (paragraph.image) {
      const activeForImage = current as Draft | null;
      if (activeForImage && !activeForImage.image) activeForImage.image = paragraph.image;
      else pendingImage = paragraph.image;
    }
    const text = paragraph.text.trim();
    if (!text) continue;
    const question = text.match(/^(?:question\s*)?(?:\d+)\s*[).:\-]\s*(.+)$/i) ?? text.match(/^question\s*:\s*(.+)$/i);
    if (question) { begin(question[1].trim()); continue; }
    const active = current as Draft | null;
    if (!active) continue;
    const option = text.match(/^([A-H])\s*[).:\-]\s*(.+)$/i);
    if (option) { active.options.push({ key: option[1].toUpperCase(), text: option[2].trim() }); continue; }
    const answer = text.match(/^(?:correct\s+answer|answer)\s*:\s*(.+)$/i);
    if (answer) { active.answer = answer[1].trim(); continue; }
    const type = text.match(/^type\s*:\s*(objective|written)/i);
    if (type) { active.type = type[1].toLowerCase() as Draft["type"]; continue; }
    const guide = text.match(/^marking\s+guide\s*:\s*(.+)$/i);
    if (guide) { active.markingGuide = guide[1].trim(); active.type = "written"; continue; }
    const explanation = text.match(/^explanation\s*:\s*(.+)$/i);
    if (explanation) { active.explanation = explanation[1].trim(); continue; }
    const points = text.match(/^(?:marks?|points?)\s*:\s*(\d+(?:\.\d+)?)/i);
    if (points) { active.points = Math.max(1, Math.min(100, Number(points[1]))); continue; }
    const maxWords = text.match(/^max(?:imum)?\s+words\s*:\s*(\d+)/i);
    if (maxWords) { active.maxWords = Math.max(20, Math.min(5000, Number(maxWords[1]))); continue; }
    if (active.type === "written" && active.markingGuide) active.markingGuide += ` ${text}`;
    else if (active.explanation) active.explanation += ` ${text}`;
  }
  finish();

  const rejected: string[] = [];
  const questions = drafts.flatMap((draft, index): Question[] => {
    if (draft.type === "written") {
      if (!draft.markingGuide) { rejected.push(`Question ${index + 1} has no marking guide.`); return []; }
      return [{ id: `imported-${Date.now()}-${index}`, prompt: draft.prompt, type: "written", options: [], answer: "", explanation: "", markingGuide: draft.markingGuide, points: draft.points, maxWords: draft.maxWords, image: draft.image }];
    }
    const answerKey = draft.answer.toUpperCase().replace(/[).]$/, "");
    const resolvedAnswer = draft.options.find((entry) => entry.key === answerKey)?.text ?? draft.options.find((entry) => entry.text.toLowerCase() === draft.answer.toLowerCase())?.text;
    if (draft.options.length < 2 || !resolvedAnswer) { rejected.push(`Question ${index + 1} needs at least two options and a valid Answer line.`); return []; }
    return [{ id: `imported-${Date.now()}-${index}`, prompt: draft.prompt, type: "objective", options: draft.options.map((entry) => entry.text), answer: resolvedAnswer, explanation: draft.explanation || "Teacher-authored question imported from a document.", points: draft.points, image: draft.image }];
  });
  return { questions, rejected };
}

export async function parseDocxQuestions(dataBase64: string) {
  const zip = await JSZip.loadAsync(dataBase64, { base64: true });
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("This Word file does not contain a readable document.");
  const relationshipXml = await zip.file("word/_rels/document.xml.rels")?.async("string") ?? "";
  const relationships = new Map<string, string>();
  for (const match of relationshipXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/g)) relationships.set(match[1], match[2]);
  const paragraphs: Array<{ text: string; image?: QuestionImage }> = [];
  for (const match of documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    const xml = match[0];
    const relId = xml.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1];
    let image: QuestionImage | undefined;
    if (relId) {
      const target = relationships.get(relId)?.replace(/^\.\.\//, "");
      const path = target ? `word/${target}`.replace(/\/+/g, "/") : "";
      const media = path ? zip.file(path) : null;
      const extension = path.split(".").pop()?.toLowerCase();
      const mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : null;
      if (media && mimeType) {
        const data = await media.async("base64");
        if (Math.ceil(data.length * 0.75) <= 750_000) image = { name: path.split("/").pop() ?? "question-image", mimeType, dataBase64: data, altText: "Imported question illustration" };
      }
    }
    paragraphs.push({ text: cleanParagraphText(xml), image });
  }
  return parseQuestionParagraphs(paragraphs);
}

export async function extractDocxText(dataBase64: string) {
  const zip = await JSZip.loadAsync(dataBase64, { base64: true });
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("This Word file does not contain a readable document.");
  return [...documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
    .map((match) => cleanParagraphText(match[0]))
    .filter(Boolean)
    .join("\n");
}

export function parsePlainTextQuestions(text: string) {
  return parseQuestionParagraphs(text.split(/\r?\n/).map((line) => ({ text: line })));
}
