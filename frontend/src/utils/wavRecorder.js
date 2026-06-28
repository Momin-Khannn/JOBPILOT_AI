function encodeWav(chunks, sampleRate) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)

  function writeString(offset, value) {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * 2, true)

  let offset = 44
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new globalThis.Blob([buffer], { type: 'audio/wav' })
}

export async function startWavRecording() {
  if (!globalThis.navigator.mediaDevices?.getUserMedia) throw new Error('Microphone recording is unavailable in this browser.')
  const stream = await globalThis.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) {
    stream.getTracks().forEach(track => track.stop())
    throw new Error('Audio recording is unavailable in this browser.')
  }
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor(4096, 1, 1)
  const chunks = []
  processor.onaudioprocess = event => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    event.outputBuffer.getChannelData(0).fill(0)
  }
  source.connect(processor)
  processor.connect(context.destination)

  async function finish(save) {
    processor.disconnect()
    source.disconnect()
    stream.getTracks().forEach(track => track.stop())
    await context.close()
    return save ? encodeWav(chunks, context.sampleRate) : null
  }

  return {
    stop: () => finish(true),
    cancel: () => finish(false),
  }
}
