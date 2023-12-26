import {useCallback, useEffect, useRef, useState} from "react"
import {nicknameColors} from "./constants"
import {Chat, ChatCmd} from "./types"

export default function useChatList(chatChannelId: string, accessToken: string, maxChatLength: number = 50) {
    const isBrowserUnloadingRef = useRef<boolean>(false)
    const lastSetTimestampRef = useRef<number>(0)
    const pendingChatListRef = useRef<Chat[]>([])
    const [chatList, setChatList] = useState<Chat[]>([])
    const [webSocketBuster, setWebSocketBuster] = useState<number>(0)

    const convertChat = useCallback((raw: any): Chat => {
        const profile = JSON.parse(raw['profile'])
        const extras = JSON.parse(raw['extras'])
        const nickname = profile.nickname
        const badge = profile.badge?.imageUrl
        const donationBadge = profile.streamingProperty?.realTimeDonationRanking?.badge?.imageUrl
        const badges = [badge, donationBadge].concat(
            profile.activityBadges?.filter(badge => badge.activated)?.map(badge => badge.imageUrl) ?? []
        ).filter(badge => badge != null)
        const channelId = raw["cid"] || raw["channelId"]
        const color = profile.title?.color ?? (profile.userIdHash + channelId).split("")
            .map(c => c.charCodeAt(0))
            .reduce((a, b) => a + b, 0) % nicknameColors.length
        const emojis = extras?.emojis || {}
        const message = raw['msg'] || raw['content'] || ''
        return {
            uid: Math.random().toString(36).substring(2, 12),
            time: raw['msgTime'] || raw['messageTime'],
            nickname,
            badges,
            color,
            emojis,
            message
        }
    }, [])

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
            if (!isBrowserUnloadingRef.current) {
                setTimeout(() => setWebSocketBuster(new Date().getTime()), 1000)
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
                        bdy: {recentMessageCount: maxChatLength},
                        cmd: ChatCmd.REQUEST_RECENT_CHAT,
                        sid,
                        tid: 2,
                        ...defaults
                    }))
                    break
                case ChatCmd.RECENT_CHAT:
                case ChatCmd.CHAT:
                    const isRecent = json.cmd == ChatCmd.RECENT_CHAT
                    const chats: Chat[] = (isRecent ? json['bdy']['messageList'] : json['bdy'])
                        .filter(chat => (chat['msgTypeCode'] || chat['messageTypeCode']) == 1)
                        .filter(chat => !((chat['msgStatusType'] || chat['messageStatusType']) == "HIDDEN"))
                        .map(convertChat)

                    if (isRecent) {
                        pendingChatListRef.current = []
                        setChatList(chats)
                    } else {
                        pendingChatListRef.current = [...pendingChatListRef.current, ...chats].slice(-1 *  maxChatLength)
                    }
                    break
            }

            if (json.cmd !== ChatCmd.PONG) {
                worker.postMessage("startPingTimer")
            }
        }

        worker.postMessage("startPingTimer")

        return () => {
            worker.postMessage("stop")
            worker.terminate()
            ws.close()
        }
    }, [accessToken, chatChannelId, convertChat, maxChatLength])

    useEffect(() => {
        return connectChzzk()
    }, [connectChzzk, webSocketBuster])

    useEffect(() => {
        window.addEventListener("beforeunload", () => isBrowserUnloadingRef.current = true)
    }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.hidden) {
                return
            }
            if (pendingChatListRef.current.length > 0) {
                if (new Date().getTime() - lastSetTimestampRef.current > 1000) {
                    setChatList((prevChatList) => {
                        const newChatList = [...prevChatList, ...pendingChatListRef.current].slice(-1 * maxChatLength)
                        pendingChatListRef.current = []
                        return newChatList
                    })
                } else {
                    setChatList((prevChatList) => {
                        const newChatList = [...prevChatList, pendingChatListRef.current.shift()]
                        if (newChatList.length > maxChatLength) {
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
    }, [maxChatLength])

    return chatList
}
