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
    const lastSetTimestampRef = useRef<number>(0)
    const pendingChatListRef = useRef<Chat[]>([])
    const [chatList, setChatList] = useState<Chat[]>([])

    const convertChat = useCallback((raw): Chat => {
        const profile = JSON.parse(raw['profile'])
        const extras = JSON.parse(raw['extras'])
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
        const message = raw['msg'] || raw['content']
        return {
            uuid: crypto.randomUUID(),
            nickname,
            badges,
            color,
            emojis,
            message
        }
    }, [chatChannelId])

    const connectChzzk = useCallback(() => {
        const ws = new WebSocket("wss://kr-ss1.chat.naver.com/chat")

        const worker = new Worker(
            URL.createObjectURL(new Blob([`
                let timeout = null

                onmessage = (e) => {
                    if (e.data === "startPingTimer") {
                        if (timeout != null) {
                            clearTimeout(timeout)
                        }
                        timeout = setTimeout(function reservePing() {
                            postMessage("ping")
                            timeout = setTimeout(reservePing, 20000)
                        }, 20000)
                    }
                    if (e.data === "stop") {
                        if (timeout != null) {
                            clearTimeout(timeout)
                        }
                    }
                }
            `], {type: "application/javascript"}))
        )

        worker.onmessage = (e) => {
            if (e.data === "ping") {
                ws.send(JSON.stringify({
                    ver: "2",
                    cmd: ChatCmd.PING
                }))
            }
        }

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
                        ver: "2",
                        cmd: ChatCmd.PONG,
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
                        .map(convertChat)

                    if (isRecent) {
                        pendingChatListRef.current = []
                        setChatList(chats)
                    } else {
                        pendingChatListRef.current = [...pendingChatListRef.current, ...chats].slice(-50)
                    }
                    break
            }

            if (json.cmd !== ChatCmd.PONG) {
                worker.postMessage("startPingTimer")
            }
        }

        worker.postMessage("startPingTimer")

        isClosingWebSocket.current = false

        return () => {
            worker.postMessage("stop")
            worker.terminate()
            isClosingWebSocket.current = true
            ws.close()
        }
    }, [accessToken, chatChannelId, convertChat])

    useEffect(() => {
        return connectChzzk()
    }, [connectChzzk])

    useEffect(() => {
        const interval = setInterval(() => {
            if (pendingChatListRef.current.length > 0) {
                if (new Date().getTime() - lastSetTimestampRef.current > 1000) {
                    setChatList((prevChatList) => {
                        return [
                            ...prevChatList.slice(pendingChatListRef.current.length - 50),
                            ...pendingChatListRef.current,
                        ]
                    })
                    pendingChatListRef.current = []
                } else {
                    const chat = pendingChatListRef.current.shift()
                    setChatList((prevChatList) => {
                        const newChatList = [...prevChatList, chat]
                        if (newChatList.length > 50) {
                            newChatList.shift()
                        }
                        return newChatList
                    })
                }
            }
            lastSetTimestampRef.current = new Date().getTime()
        }, 75)
        return () => {
            clearInterval(interval)
            lastSetTimestampRef.current = 0
        }
    }, [])

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

    return (
        <div id="log" className={clsx(small && "small")}>
            {chatList.map((chat) => (
                <ChatRow key={chat.uuid} {...chat} />
            ))}
        </div>
    )
}
