export class VideoProvider {
  constructor({ providerId }) {
    this.providerId = providerId;
  }

  async startJob() {
    throw new Error('startJob must be implemented by the provider.');
  }

  async pollJob() {
    throw new Error('pollJob must be implemented by the provider.');
  }

  async downloadAsset() {
    throw new Error('downloadAsset must be implemented by the provider.');
  }
}
