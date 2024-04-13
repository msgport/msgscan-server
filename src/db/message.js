import sql from './db.js'
import { MESSAGE_STATUS } from '../constants.js'

const MESSAGE_TABLE = 'Message'

async function getLastMessageIndex(chainId) {
  const result = await sql`
    SELECT max("messageIndex") as max_index FROM public.${sql(MESSAGE_TABLE)} WHERE "messageFromChainId" = ${chainId}
  `
  return result[0].max_index || 0
}

async function extractMsgportPayload(message) {
  if (!message.messageEncoded.startsWith('0x394d1bca')) {
    return { msgportFrom: null, msgportTo: null, msgportPayload: null }
  }
  const msgportFrom = '0x' + message.messageEncoded.slice(34, 74)
  const msgportTo = '0x' + message.messageEncoded.slice(98, 138)
  const msgportPayload = '0x' + message.messageEncoded.slice(266)
  return { msgportFrom, msgportTo, msgportPayload }
}

async function createMessage(message) {
  const id = `${message.messageFromChainId}-${message.messageIndex}`
  console.log(`processing message ${id}`)

  // check if message already exists
  const exists = await sql`
    SELECT EXISTS (
      SELECT * FROM public.${sql(MESSAGE_TABLE)} WHERE id=${id}
    );
  `
  if (exists[0].exists) {
    console.log(`message ${id} already exists`)
    return
  }

  // if not, create message
  const { msgportFrom, msgportTo, msgportPayload } = await extractMsgportPayload(message)
  await sql`
    INSERT INTO public.${sql(MESSAGE_TABLE)} (
      id,
      "msgHash",
      root,
      "messageChannel",
      "messageIndex",
      "messageFromChainId",
      "messageFrom",
      "messageToChainId",
      "messageTo",
      "messageGasLimit",
      "messageEncoded",
      "acceptedBlockNumber",
      "acceptedBlockTimestamp",
      "acceptedTransactionHash",
      "acceptedTransactionIndex",
      "acceptedLogIndex",
      "status",
      "msgportFrom",
      "msgportTo",
      "msgportPayload"
    )
    VALUES (
      ${id},
      ${message.msgHash},
      ${message.root},
      ${message.messageChannel},
      ${message.messageIndex},
      ${message.messageFromChainId},
      ${message.messageFrom},
      ${message.messageToChainId},
      ${message.messageTo},
      ${message.messageGasLimit},
      ${message.messageEncoded},
      ${message.blockNumber},
      ${message.blockTimestamp},
      ${message.transactionHash},
      ${message.transactionIndex},
      ${message.logIndex},
      ${MESSAGE_STATUS.ACCEPTED},
      ${msgportFrom},
      ${msgportTo},
      ${msgportPayload}
    )
  `
}

async function findMessagesByStatus(messageFromChainId, status) {
  const result = await sql`
    SELECT *
    FROM public.${sql(MESSAGE_TABLE)}
    WHERE "messageFromChainId" = ${messageFromChainId} and "status" = ${status}
  `
  return result
}

async function findMessageByRoot(messageFromChainId, root) {
  const result = await sql`
    SELECT *
    FROM public.${sql(MESSAGE_TABLE)}
    WHERE "messageFromChainId" = ${messageFromChainId} and "root" = ${root}
  `
  return result[0]
}

async function updateMessageStatus(message, status) {
  await sql`
    UPDATE public.${sql(MESSAGE_TABLE)}
    SET status = ${status}
    WHERE id = ${message.id}
  `
}

async function updateMessage(message, fields) {
  const sets = Object.entries(fields).map(([key, value]) => {
    return `"${key}" = ${value}`
  }).join(', ')

  await sql`
    UPDATE public.${sql(MESSAGE_TABLE)}
    SET ${sql.raw(sets)}
    WHERE id = ${message.id}
  `
}

export { getLastMessageIndex, createMessage, findMessagesByStatus, findMessageByRoot, updateMessageStatus, updateMessage }
