const profilePhotoService = (() => {
  const BUCKET = "profile-photos";
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const SIGNED_URL_TTL_SECONDS = 3600;
  const SIGNED_URL_REFRESH_MARGIN_MS = 60 * 1000;
  const VALID_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const signedUrls = new Map();
  const result = (success, message, data = null) => ({ success, message, data });

  function validateFile(file) {
    if (!file || !VALID_TYPES.has(String(file.type || "").toLowerCase())) return result(false, "Choose a JPEG, PNG, or WebP image.");
    if (file.size > MAX_FILE_BYTES) return result(false, "Profile photos must be 5 MB or smaller.");
    return result(true, "Photo is ready to upload.", file);
  }

  function ownPath(profile) {
    const authUserId = String(profile?.authUserId || "").trim();
    return authUserId ? `${authUserId}/profile` : "";
  }

  function isOwnProfile(profile) {
    const current = loginService.getCurrentAccount?.();
    return Boolean(profile?.id && profile?.authUserId && current?.id && String(profile.id) === String(current.id));
  }

  async function createDisplayUrl(photoPath) {
    const path = String(photoPath || "").trim();
    if (!path) return "";
    const cached = signedUrls.get(path);
    if (cached && cached.expiresAt - SIGNED_URL_REFRESH_MARGIN_MS > Date.now()) return cached.url;
    const client = await supabaseClientService.getClient();
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    const url = data?.signedUrl || "";
    if (url) signedUrls.set(path, { url, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 });
    return url;
  }

  async function uploadOwnPhoto(file) {
    const validation = validateFile(file);
    if (!validation.success) return validation;
    const profile = portalService.getProfile();
    if (!isOwnProfile(profile)) return result(false, "You may change only your own profile photo.");
    const path = ownPath(profile);
    const previousPath = profile.photoPath || "";
    const client = await supabaseClientService.getClient();
    const upload = await client.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: true });
    if (upload.error) return result(false, upload.error.message || "The photo could not be uploaded.");
    if (previousPath !== path) {
      const updated = await supabaseSharedRepository.updateProfilePhoto(profile.id, path);
      if (updated.error) {
        if (!previousPath) await client.storage.from(BUCKET).remove([path]);
        return result(false, updated.error.message || "The photo was uploaded but could not be saved to your profile.");
      }
    }
    signedUrls.delete(path);
    let photoUrl = "";
    try { photoUrl = await createDisplayUrl(path); } catch (_error) {}
    accountService.updateAuthenticatedPhotoState(path, photoUrl);
    return result(true, photoUrl ? "Profile photo updated." : "Profile photo updated. The preview will be available after refresh.", { photoPath: path, photoUrl });
  }

  async function removeOwnPhoto() {
    const profile = portalService.getProfile();
    if (!isOwnProfile(profile)) return result(false, "You may change only your own profile photo.");
    const previousPath = String(profile.photoPath || "");
    if (!previousPath) return result(true, "Profile photo removed.", { photoPath: "", photoUrl: "" });
    const client = await supabaseClientService.getClient();
    const updated = await supabaseSharedRepository.updateProfilePhoto(profile.id, null);
    if (updated.error) return result(false, updated.error.message || "The profile photo could not be removed.");
    const removed = await client.storage.from(BUCKET).remove([previousPath]);
    if (removed.error) {
      const rollback = await supabaseSharedRepository.updateProfilePhoto(profile.id, previousPath);
      if (!rollback.error) accountService.updateAuthenticatedPhotoState(previousPath, profile.photoUrl || "");
      return result(false, removed.error.message || "The profile photo file could not be removed.");
    }
    signedUrls.delete(previousPath);
    accountService.updateAuthenticatedPhotoState("", "");
    return result(true, "Profile photo removed.", { photoPath: "", photoUrl: "" });
  }

  return { BUCKET, MAX_FILE_BYTES, VALID_TYPES, validateFile, ownPath, createDisplayUrl, uploadOwnPhoto, removeOwnPhoto };
})();
