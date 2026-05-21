export function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.MapsPlatformAPIKey;
}
