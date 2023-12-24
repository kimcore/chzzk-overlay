"use client"

import {useCallback, useEffect} from "react"
import {useSearchParams} from "next/navigation"
import {clsx} from "clsx"
import useChatList from "../chat/useChatList"
import ChatRow from "./ChatRow"
import useNotice from "@/src/hooks/use-notice"

export default function ChatBox({chatChannelId, accessToken}) {
    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    const chatList = useChatList(chatChannelId, accessToken)

    const handleObsStreamingStarted = useCallback(() => {
        window.location.reload()
    }, [])

    // requires obs 30.0.1+
    useEffect(() => {
        window.addEventListener("obsStreamingStarted", handleObsStreamingStarted)

        return () => {
            window.removeEventListener("obsStreamingStarted", handleObsStreamingStarted)
        }
    }, [handleObsStreamingStarted])

    useNotice()

    return (
        <div id="log" className={clsx(small && "small")}>
            {chatList.map((chat) => (
                <ChatRow key={chat.uid} {...chat} />
            ))}
        </div>
    )
}
