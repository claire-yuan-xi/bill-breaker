// Model admin playground: ranks pasted bill text for a reader on the server and
// swaps in the rendered tables; calls the hosted model once ML_ENDPOINT is set.

import { $, $$ } from "../lib/dom.js";
import { postJSON } from "../lib/api.js";
import { readProfile } from "../lib/reader-profile.js";

const root = $("[data-playground]");
const example = JSON.parse($("#example-profile").textContent);
const text = $("[data-pg-text]", root);
const generate = $("[data-pg-generate]", root);
const error = $("[data-pg-error]", root);
let reader = "example";
let timer = 0;

const profile = () => (reader === "example" ? example : readProfile());

async function rank() {
  try {
    const data = await postJSON("/api/admin/ml/rank", { text: text.value, profile: profile() });
    $("[data-pg-terms]", root).innerHTML = data.termsHtml;
    $("[data-pg-table]", root).innerHTML = data.tableHtml;
    generate.disabled = !text.value.trim() || generate.hasAttribute("data-no-endpoint");
    error.textContent = "";
  } catch (err) {
    error.textContent = err.message;
  }
}

$$("[data-reader]", root).forEach((tab) =>
  tab.addEventListener("click", () => {
    reader = tab.dataset.reader;
    $$("[data-reader]", root).forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    rank();
  }),
);

text.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(rank, 250);
});

generate.addEventListener("click", async () => {
  generate.disabled = true;
  error.textContent = "";
  try {
    const data = await postJSON("/api/admin/ml/generate", { text: text.value, profile: profile() });
    $("[data-pg-result]", root).innerHTML = data.html;
  } catch (err) {
    error.textContent = err.message;
  } finally {
    generate.disabled = false;
  }
});
