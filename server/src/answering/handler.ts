import express, { Request, Response, Router } from 'express'
import * as z from 'zod'

import { auth, safeRouteHandler } from '../lib/express'
import log from '../lib/log'
import { cleanQuestion } from '../lib/text'
import { getAnswer } from './qa'
import { lookUp } from './search'

const router = Router()

const searchSchema = z.object({
  query: z.string()
})

const TOP_K = 3

const ask = async (req: Request, res: Response) => {
  const input = await searchSchema.parseAsync(req.body)
  const userId = req.session.userId
  const resp = await lookUp(userId, cleanQuestion(input.query))

  if (resp.length === 0) {
    res.json({ result: [{ score: 100, answer: '' }] })

    return
  }

  log.debug(resp)

  const result = await Promise.all(
    resp.map(({ content }) => {
      log.debug(content)
      log.debug('content finished')

      return getAnswer(input.query, content)
    })
  )

  const cleaned = result
    .filter((r) => r.answer.length > 0)
    .sort((a, b) => {
      if (!a.answer) return 1
      if (!b.answer) return -1

      return b.score - a.score
    })
    //removeDuplicates
    .filter((thing, idx, self) => idx === self.findIndex((t) => t.answer === thing.answer && t.score === thing.score))

  if (cleaned.length === 0) {
    res.json({ result: [{ score: 100, answer: '' }] })

    return
  }

  res.status(200).json({ result: cleaned.splice(0, TOP_K) })
}

router.post('/query', auth, express.json(), safeRouteHandler(ask))

export default router
