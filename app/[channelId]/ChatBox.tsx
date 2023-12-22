"use client"

import {useCallback, useEffect, useState} from "react"
import {useSearchParams} from "next/navigation"
import {clsx} from "clsx"
import {ChatCmd} from "chzzk"
import ChatRow, {Chat, nicknameColors} from "./ChatRow"

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))

}

export default function ChatBox({chatChannelId, accessToken}) {
    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    const [chatList, setChatList] = useState<Chat[]>([])

    const appendChat = useCallback((chat: Chat) => {
        setChatList((prevChatList) => {
            const newChatList = [...prevChatList, chat]
            if (newChatList.length > 50) {
                newChatList.shift()
            }
            return newChatList
        })
    }, [])

    function onChat(chat) {
        if ((chat['msgStatusType'] || chat['messageStatusType']) == "HIDDEN") return

        const nickname = chat.profile.nickname
        const badge = chat.profile.badge ? {
            name: chat.profile.title.name, src: chat.profile.badge.imageUrl
        } : null
        const badges = (badge ? [badge] : []).concat(
            chat.profile.activityBadges
                ?.filter(badge => badge.activated)
                ?.map(badge => ({name: badge.title, src: badge.imageUrl})) ?? []
        )
        const color = chat.profile.title?.color ?? (chat.profile.userIdHash + chatChannelId).split("")
            .map(c => c.charCodeAt(0))
            .reduce((a, b) => a + b, 0) % nicknameColors.length
        const emojis = chat.extras?.emojis || {}
        const message = chat.message

        appendChat({
            uuid: crypto.randomUUID(),
            nickname,
            badges,
            color,
            emojis,
            message
        })
    }

    function connectChzzk() {
        const ws = new WebSocket("wss://kr-ss1.chat.naver.com/chat")

        const defaults = {
            cid: chatChannelId,
            svcid: "game",
            ver: "2"
        }

        ws.onopen = () => {
            ws.send(JSON.stringify({
                bdy: {
                    accTkn: accessToken,
                    auth: "READ",
                    devType: 2001,
                    uid: null
                },
                cmd: ChatCmd.CONNECT,
                tid: 1,
                ...defaults
            }))
        }

        ws.onclose = () => {
            setTimeout(() => {
                connectChzzk()
            }, 1000)
        }

        ws.onmessage = async (event: MessageEvent) => {
            const json = JSON.parse(event.data)

            switch (json.cmd) {
                case ChatCmd.PING:
                    ws.send(JSON.stringify({
                        cmd: ChatCmd.PONG,
                        tid: json.tid
                    }))
                    break
                case ChatCmd.CONNECTED:
                    const sid = json.bdy.sid
                    ws.send(JSON.stringify({
                        bdy: {recentMessageCount: 50},
                        cmd: ChatCmd.REQUEST_RECENT_CHAT,
                        sid,
                        tid: 2,
                        ...defaults
                    }))
                    break
                case ChatCmd.RECENT_CHAT:
                case ChatCmd.CHAT:
                    const isRecent = json.cmd == ChatCmd.RECENT_CHAT
                    const chats = (isRecent ? json['bdy']['messageList'] : json['bdy'])
                        .filter(chat => (chat['msgTypeCode'] || chat['messageTypeCode']) == 1)

                    for (let i = 0; i < chats.length; i++) {
                        const chat = chats[i]
                        const profile = JSON.parse(chat['profile'])
                        const extras = JSON.parse(chat['extras'])

                        if (!isRecent) {
                            await sleep(i * 75)
                        }

                        onChat({
                            profile,
                            extras,
                            message: chat['msg'] || chat['content'],
                        })
                    }

                    break
            }
        }
    }

    useEffect(() => {
        // requires obs 30.0.1+
        window.addEventListener("obsStreamingStarted", () => {
            window.location.reload()
        })
        connectChzzk()
    }, [])

    return (
        <div id="log" className={clsx(small && "small")}>
            {chatList.map((chat) => (
                <ChatRow key={chat.uuid} {...chat} />
            ))}
        </div>
    )
}
