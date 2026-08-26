import { IMediaIngestionService, IngestionResult } from '../../services/MediaIngestionService';
import { MediaContent } from '../../domain/entities/MediaContent';

export interface IContentIngestionUseCase {
  execute(contentData: ContentData): Promise<IngestionResult>;
}

export interface ContentData {
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: string[];
}

export class ContentIngestionUseCase implements IContentIngestionUseCase {
  constructor(private readonly ingestionService: IMediaIngestionService) {}

  async execute(contentData: ContentData): Promise<IngestionResult> {
    const content = MediaContent.create(
      contentData.title,
      contentData.description,
      contentData.genre,
      new Date(contentData.releaseDate),
      contentData.cast
    );

    return this.ingestionService.process(content);
  }
}
