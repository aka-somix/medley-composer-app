import type { Request, Response } from "express";
import type { SongService } from "../services/song.service.js";
import type { SuggestionService } from "../services/suggestion.service.js";
import {
  batchImportSchema,
  createSongSchema,
  listQuerySchema,
  searchQuerySchema,
  updateSongSchema,
} from "../validation.js";

/**
 * REST controller for the /songs resource. Methods are thin: validate input,
 * delegate to a service, shape the HTTP response. Errors bubble to the shared
 * error middleware via asyncHandler.
 */
export class SongsController {
  constructor(
    private readonly songService: SongService,
    private readonly suggestionService: SuggestionService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { page, pageSize } = listQuerySchema.parse(req.query);
    res.json(await this.songService.list(page, pageSize));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const { q } = searchQuerySchema.parse(req.query);
    res.json(await this.songService.search(q));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.songService.getById(req.params.id!));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = createSongSchema.parse(req.body);
    const song = await this.songService.create(body);
    res.status(201).json(song);
  };

  batchImport = async (req: Request, res: Response): Promise<void> => {
    const { songs } = batchImportSchema.parse(req.body);
    const result = await this.songService.createMany(songs);
    res.status(201).json(result);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const body = updateSongSchema.parse(req.body);
    res.json(await this.songService.update(req.params.id!, body));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.songService.delete(req.params.id!);
    res.status(204).end();
  };

  suggestions = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.suggestionService.getSuggestions(req.params.id!));
  };
}
