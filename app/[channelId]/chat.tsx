"use client"

import {useEffect} from "react"
import {useSearchParams} from "next/navigation"
import {clsx} from "clsx"
import {ChatCmd} from "chzzk"

const colors = [
    "rgb(219, 74, 63)",
    "rgb(95, 158, 160)",
    "rgb(218, 165, 32)",
    "rgb(0, 255, 127)",
    "rgb(180, 84, 255)",
    "rgb(30, 144, 255)"
]

const emojiRegex = /{:([a-zA-Z0-9_]+):}/g

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))

}

export default function ChatBox({chatChannelId, accessToken}) {
    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    const defaults = {
        cid: chatChannelId,
        svcid: "game",
        ver: "2"
    }

    function appendChat({nickname, badges, color, emojis, message}) {
        const elem = document.createElement("div")
        elem.setAttribute("data-from", nickname)

        const meta = document.createElement("span")
        meta.className = "meta"
        meta.style.color = typeof color == "number" ? colors[color] : color

        badges.forEach(badge => {
            const img = document.createElement("img")
            img.className = "badge"
            img.alt = badge.name
            img.src = badge.src
            meta.appendChild(img)
        })

        const name = document.createElement("span")
        name.className = "name"
        name.innerText = nickname
        meta.appendChild(name)

        const colon = document.createElement("span")
        colon.className = "colon"
        colon.innerText = ":"
        meta.appendChild(colon)

        elem.appendChild(meta)

        const msg = document.createElement("span")
        msg.className = "message"

        const match = message.match(emojiRegex)

        if (match) {
            message.split(emojiRegex).forEach((part, i) => {
                if (i % 2 == 0) {
                    msg.appendChild(document.createTextNode(part))
                } else {
                    const src = emojis[part]
                    const emoteWrap = document.createElement("span")
                    emoteWrap.className = "emote_wrap"
                    const emote = document.createElement("img")
                    emote.className = "emoticon"
                    emote.alt = `{:${part}:}`
                    emote.src = src
                    emoteWrap.appendChild(emote)
                    msg.appendChild(emoteWrap)
                }
            })
        } else {
            msg.innerText = message
        }

        elem.appendChild(msg)

        const log = document.getElementById("log")

        log.appendChild(elem)

        if (log.children.length > 50) {
            log.removeChild(log.children[0])
        }

        window.scrollTo(0, document.body.scrollHeight)
    }

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
        const color = chat.profile.title?.color ?? nickname.split("")
            .map(c => c.charCodeAt(0))
            .reduce((a, b) => a + b, 0) % colors.length
        const emojis = chat.extras?.emojis || {}
        const message = chat.message

        appendChat({
            nickname,
            badges,
            color,
            emojis,
            message
        })
    }

    async function onMessage(event: MessageEvent) {
        const json = JSON.parse(event.data)

        switch (json.cmd) {
            case ChatCmd.PING:
                this.send(JSON.stringify({
                    cmd: ChatCmd.PONG,
                    tid: json.tid
                }))
                break
            case ChatCmd.CONNECTED:
                const sid = json.bdy.sid
                this.send(JSON.stringify({
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

                for (const chat of chats) {
                    const profile = JSON.parse(chat['profile'])
                    const extras = JSON.parse(chat['extras'])

                    if (!isRecent) {
                        await sleep(5)
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

    function connectChzzk() {
        const ws = new WebSocket("wss://kr-ss1.chat.naver.com/chat")

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

        ws.onmessage = onMessage
    }

    useEffect(() => {
        // requires obs 30.0.1+
        window.addEventListener("obsStreamingStarted", () => {
            window.location.reload()
        })
        connectChzzk()
    }, [])

    return (
        <div id="log" className={clsx(small && "small")}/>
    )
}