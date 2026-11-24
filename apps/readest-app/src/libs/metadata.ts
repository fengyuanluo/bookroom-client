import { MetadataResult, SearchRequest } from '@/services/metadata/types';
import { MetadataService } from '@/services/metadata/service';

// Open Library answers CORS for any origin, so the client queries it directly.
const service = new MetadataService();

export const searchMetadata = (request: SearchRequest): Promise<MetadataResult[]> =>
  service.search(request);
