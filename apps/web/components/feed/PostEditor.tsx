import React, { useState } from "react";
import { Card } from "../ui/Card";

interface PostEditorProps {
    onPublish: (text: string) => void;
}

export const PostEditor = ({ onPublish }: PostEditorProps) => {
    const [postText, setPostText] = useState<string>("");

    const handlePublish = () => {
        if (postText.trim()) {
            onPublish(postText);
            setPostText("");
        }
    };

    return (
        <Card className="mb-8 p-0 overflow-hidden border-gray-200 shadow-sm">
            <textarea
                value={postText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPostText(e.target.value)
                }
                placeholder="¿Qué estás pensando?"
                maxLength={500}
                className="w-full min-h-32 p-5 text-body font-body focus:outline-none resize-none placeholder:text-gray-400"
            />

            <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100 bg-white">
                <span className="text-xs text-body-secondary font-medium font-body">
                    {postText.length}/500
                </span>
                <button
                    onClick={handlePublish}
                    disabled={!postText.trim()}
                    className="flex items-center gap-2 bg-body-secondary disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary text-white px-5 py-2.5 rounded-md font-body font-semibold transition-colors text-sm"
                >
                    <img
                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/send.svg"
                        className="size-4 filter invert"
                        alt=""
                    />
                    Publicar post
                </button>
            </div>
        </Card>
    );
};
