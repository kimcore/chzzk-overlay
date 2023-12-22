"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {useSearchParams} from "next/navigation"
import {clsx} from "clsx"
import {ChatCmd} from "chzzk"
import ChatRow, {Chat, nicknameColors} from "./ChatRow"

export default function ChatBox({chatChannelId, accessToken}) {
    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    const isClosingWebSocket = useRef<boolean>(false)
    const pendingChatListRef = useRef<Chat[]>([])
    const [chatList, setChatList] = useState<Chat[]>([])

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
            if (!isClosingWebSocket) {
                setTimeout(() => {
                    connectChzzk()
                }, 1000)
            }
        }

        ws.onmessage = (event: MessageEvent) => {
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
                        .filter(chat => !((chat['msgStatusType'] || chat['messageStatusType']) == "HIDDEN"))
                        .sort((a, b) => a.msgTime - b.msgTime)
                        .map(chat => {
                            const profile = JSON.parse(chat['profile'])
                            const extras = JSON.parse(chat['extras'])
                            const nickname = profile.nickname
                            const badge = profile.badge ? {
                                name: profile.title.name, src: profile.badge.imageUrl
                            } : null
                            const badges = (badge ? [badge] : []).concat(
                                profile.activityBadges
                                    ?.filter(badge => badge.activated)
                                    ?.map(badge => ({name: badge.title, src: badge.imageUrl})) ?? []
                            )
                            const color = profile.title?.color ?? (profile.userIdHash + chatChannelId).split("")
                                .map(c => c.charCodeAt(0))
                                .reduce((a, b) => a + b, 0) % nicknameColors.length
                            const emojis = extras?.emojis || {}
                            const message = chat['msg'] || chat['content']
                            return {
                                uuid: crypto.randomUUID(),
                                nickname,
                                badges,
                                color,
                                emojis,
                                message
                            }
                        })

                    pendingChatListRef.current = [...pendingChatListRef.current, ...chats].slice(-50)
                    break
            }
        }

        isClosingWebSocket.current = false

        return () => {
            isClosingWebSocket.current = true
            ws.close()
        }
    }

    useEffect(() => {
        // requires obs 30.0.1+
        window.addEventListener("obsStreamingStarted", () => {
            window.location.reload()
        })
        return connectChzzk()
    }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            if (pendingChatListRef.current.length > 0) {
                const chat = pendingChatListRef.current.shift()
                setChatList((prevChatList) => {
                    const newChatList = [...prevChatList, chat]
                    if (newChatList.length > 50) {
                        newChatList.shift()
                    }
                    return newChatList
                })
            }
        }, 75)
        return () => clearInterval(interval)
    }, [])

    return (
        <div id="log" className={clsx(small && "small")}>
            {chatList.map((chat) => (
                <ChatRow key={chat.uuid} {...chat} />
            ))}
        </div>
    )
}
