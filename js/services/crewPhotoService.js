const crewPhotoService = (() => {
  const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
  const MAX_DIMENSION = 512;
  const VALID_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  function result(success, message, data = null, errors = {}) {
    return { success, message, data, errors };
  }

  async function processFile(file) {
    if (!file || !VALID_TYPES.has(file.type)) return result(false, "Use a JPEG, PNG, or WebP image.", null, { photo: "Unsupported image format." });
    if (file.size > MAX_SOURCE_BYTES) return result(false, "Photo files must be 2 MB or smaller.", null, { photo: "Photo exceeds the 2 MB source limit." });
    try {
      const source = await readFile(file);
      const image = await loadImage(source);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/webp", 0.78);
      const validation = accountService.validatePhotoDataUrl(dataUrl);
      return validation.success ? result(true, "Photo ready.", dataUrl) : validation;
    } catch (_error) {
      return result(false, "The selected image could not be processed.", null, { photo: "Invalid image file." });
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  return { processFile, MAX_SOURCE_BYTES, MAX_DIMENSION };
})();
