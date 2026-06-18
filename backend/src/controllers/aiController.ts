import { Request, Response, NextFunction } from 'express';
import { chatWithAI, getPredictions, getAnomalies } from '../services/aiService';
import { createError } from '../middleware/errorHandler';

export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message } = req.body;
    if (!message) throw createError('message is required');
    const reply = await chatWithAI(message as string);
    res.json({ success: true, data: { reply } });
  } catch (err) { next(err); }
}

export async function predictions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getPredictions();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function anomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getAnomalies();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
