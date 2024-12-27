import { useState, useRef, useEffect } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';

interface Props {
  userId: number;
  targetLanguage: string;
  nativeLanguage: string;
  onClose: () => void;
}

export function LanguageExchangeCall({ userId, targetLanguage, nativeLanguage, onClose }: Props) {
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [partner, setPartner] = useState<{ id: number; name: string } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket(`wss://${window.location.host}/ws/language-exchange`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'init',
        userId,
        targetLanguage,
        nativeLanguage
      }));
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'match-found':
          setPartner({ id: message.partnerId, name: message.partnerName });
          setIsSearching(false);
          setIsConnected(true);
          await initializePeerConnection(message.partnerId);
          break;

        case 'offer':
          if (peerRef.current) {
            await peerRef.current.signal(message.data);
          }
          break;

        case 'answer':
          if (peerRef.current) {
            await peerRef.current.signal(message.data);
          }
          break;

        case 'ice-candidate':
          if (peerRef.current) {
            await peerRef.current.signal(message.data);
          }
          break;
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [userId, targetLanguage, nativeLanguage]);

  const initializePeerConnection = async (partnerId: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const peer = new Peer({
        initiator: partnerId > userId,
        trickle: true,
        stream
      });

      peer.on('signal', data => {
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'signaling',
            signalingType: data.type,
            signalingData: data,
            to: partnerId
          }));
        }
      });

      peer.on('stream', remoteStream => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      peer.on('error', err => {
        console.error('Peer error:', err);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Failed to establish connection with partner"
        });
        handleEndCall();
      });

      peerRef.current = peer;

    } catch (error) {
      console.error('Media access error:', error);
      toast({
        variant: "destructive",
        title: "Media Access Error",
        description: "Could not access camera or microphone"
      });
    }
  };

  const startSearching = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'start-search',
        targetLanguage,
        nativeLanguage
      }));
      setIsSearching(true);
    }
  };

  const handleEndCall = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop-search' }));
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    setIsConnected(false);
    setPartner(null);
    onClose();
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleEndCall}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isSearching 
              ? "Finding a language partner..." 
              : isConnected 
                ? `Speaking with ${partner?.name}`
                : "Start Language Exchange"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-2">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded-lg bg-black"
              />
              <p className="text-sm text-center mt-2">You</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2">
              {isConnected ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
              ) : (
                <div className="w-full aspect-video rounded-lg bg-black flex items-center justify-center">
                  {isSearching ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <span className="text-white">Start searching to find a partner</span>
                  )}
                </div>
              )}
              <p className="text-sm text-center mt-2">
                {partner ? partner.name : "Partner"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center gap-4">
          {!isSearching && !isConnected ? (
            <Button onClick={startSearching}>
              Find Language Partner
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video /> : <VideoOff />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic /> : <MicOff />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleEndCall}
              >
                <PhoneOff />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
