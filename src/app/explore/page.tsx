import { ChatInterface } from '@/components/chat/ChatInterface';

export const metadata = {
  title: 'AI Explore | NYC School Explorer',
  description: 'Explore NYC school data through AI-powered natural language conversation.',
};

export default function ExplorePage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface />
    </div>
  );
}
