import { convert } from "html-to-text";
import { OpenUrlOutputSchema } from "./schemas";

export async function openUrl(url: string) {
  const normalized = validateUrl(url);

  //fetch the page
  const res = await fetch(normalized, {
    headers: {
      "User-Agent": "agent-core/1.0 (+course-demo)",
    },
  });

  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(`OpenURL failed ${res.status} -  ${body.slice(0, 200)}`);
  }

  //   step 3
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  //   step 4 HTML -> normal (plain) text
  const normalText = contentType.includes("text/html")
    ? convert(raw, {
        wordwrap: false,
        selectors: [
          {
            selector: "nav",
            format: "skip",
          },
          {
            selector: "header",
            format: "skip",
          },
          {
            selector: "footer",
            format: "skip",
          },
          {
            selector: "script",
            format: "skip",
          },
        ],
      })
    : raw;

  // step 5 -
  const cleaned = collapseWhiteSpace(normalText);
  const capped = cleaned.slice(0, 8000);

  //return the result
  return OpenUrlOutputSchema.parse({
    url: normalized,
    content: capped,
  });
}

function validateUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("Only HTTPS allowed!");
    }
    return parsed.toString();
  } catch (err) {
    throw new Error("Invalid URL");
  }
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch (err) {
    return "<no body>";
  }
}

function collapseWhiteSpace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
