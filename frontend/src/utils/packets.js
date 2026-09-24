export const STATE_PACKET_CODE = {
  1: 'FL',
  2: 'IN',
  3: 'GA',
  florida: 'FL',
  indiana: 'IN',
  georgia: 'GA',
};

export function packetUrl(code) {
  const safe = STATE_PACKET_CODE[code] || STATE_PACKET_CODE[1];
  return `/packets/${safe}-Employment-Packet.pdf`;
}