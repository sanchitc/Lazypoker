import type { Socket } from 'socket.io';
import type { Request } from 'express';

export function extractIpFromSocket(socket: Socket): string {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
  if (fwdStr) {
    const first = fwdStr.split(',')[0]?.trim();
    if (first) return normalize(first);
  }
  return normalize(socket.handshake.address ?? '');
}

export function extractIpFromRequest(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
  if (fwdStr) {
    const first = fwdStr.split(',')[0]?.trim();
    if (first) return normalize(first);
  }
  return normalize(req.socket.remoteAddress ?? '');
}

function normalize(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function maskIp(ip: string): string {
  if (!ip) return '';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + ':xxxx';
  }
  return ip;
}
