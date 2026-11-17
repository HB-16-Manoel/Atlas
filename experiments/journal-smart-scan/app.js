const photo = document.querySelector("#photo");
const preview = document.querySelector("#preview");
const text = document.querySelector("#transcription");
const status = document.querySelector("#status");
const scan = document.querySelector("#scan");
let previewUrl;

photo.addEventListener("change", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  if (!photo.files[0]) { preview.hidden = true; return; }
  previewUrl = URL.createObjectURL(photo.files[0]);
  preview.src = previewUrl;
  preview.hidden = false;
  status.textContent = "";
});

scan.addEventListener("click", async () => {
  const file = photo.files[0];
  if (!file) { status.textContent = "Choose a photo first."; status.className = "error"; return; }
  scan.disabled = true;
  status.className = "";
  status.textContent = "Recognizing handwriting…";
  try {
    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the photo."));
      reader.readAsDataURL(file);
    });
    const response = await fetch("/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Recognition failed.");
    text.value = result.text;
    status.textContent = result.uncertainWords ? `${result.uncertainWords} uncertain word(s) marked [unclear]. Review everything before using it.` : "Ready for review. Check every word before using it.";
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  } finally { scan.disabled = false; }
});

document.querySelector("#download").addEventListener("click", () => {
  if (!text.value.trim()) { status.textContent = "There is no text to download."; return; }
  const url = URL.createObjectURL(new Blob([text.value], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "atlas-journal-transcription.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
