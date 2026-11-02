import { toOrder } from '../api/mappers'
import type { OrderDto } from '../api/contracts'
import seed from '../mocks/data/order.json'

export const seedOrderDto = (): OrderDto => structuredClone(seed) as OrderDto

/** The provided sample order (ORD-10482) mapped to the domain model. */
export const sampleOrder = () => toOrder(seedOrderDto())
