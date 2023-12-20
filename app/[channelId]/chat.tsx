"use client"

import useWebSocket, {ReadyState} from "react-use-websocket"
import {Fragment, useEffect, useState} from "react"
import {useSearchParams} from "next/navigation"
import {clsx} from "clsx"

const colors = [
    "rgb(219, 74, 63)",
    "rgb(95, 158, 160)",
    "rgb(218, 165, 32)",
    "rgb(0, 255, 127)",
    "rgb(180, 84, 255)",
    "rgb(30, 144, 255)"
]

const emojiRegex = /{:([a-zA-Z0-9_]+):}/g

export default function Chat({chatChannelId, accessToken}) {
    const {sendMessage, lastJsonMessage, readyState} = useWebSocket("wss://kr-ss1.chat.naver.com/chat")
    const [chats, setChats] = useState([])

    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    const defaults = {
        cid: chatChannelId,
        svcid: "game",
        ver: "2"
    }

    useEffect(() => {
        if (lastJsonMessage) {
            const json = lastJsonMessage as any

            switch (json.cmd) {
                case 0:
                    sendMessage(JSON.stringify({
                        cmd: 100,
                        ver: "2"
                    }))
                    break
                case 10100:
                    const sid = json['bdy']['sid']
                    sendMessage(JSON.stringify({
                        bdy: {recentMessageCount: 50},
                        cmd: 5101,
                        sid,
                        tid: 2,
                        ...defaults
                    }))
                    break
                case 93101:
                case 15101:
                    const list = (json.cmd == 93101 ? json['bdy'] : json['bdy']['messageList'])
                        .filter(chat => (chat['msgTypeCode'] || chat['messageTypeCode']) == 1)
                        .map(chat => {
                            const profile = JSON.parse(chat['profile'])
                            const nickname = profile.nickname
                            const color = nickname.split("")
                                .map(c => c.charCodeAt(0))
                                .reduce((a, b) => a + b, 0) % colors.length
                            const badges = profile['activityBadges']?.map(badge => badge['imageUrl']) || []
                            const extras = JSON.parse(chat['extras'])
                            const emojis = extras.emojis || {}
                            const message = chat['msg'] || chat['content']

                            return {
                                badges,
                                color,
                                nickname,
                                emojis,
                                message
                            }
                        })

                    setChats((prevState) => {
                        const newChats = prevState.concat(list)

                        if (newChats.length > 50) {
                            newChats.splice(0, newChats.length - 50)
                        }

                        return newChats
                    })

                    break
            }
        }
    }, [lastJsonMessage])

    useEffect(() => {
        window.scrollTo(0, document.body.scrollHeight)
    }, [chats])

    useEffect(() => {
        if (readyState == ReadyState.OPEN) {
            sendMessage(JSON.stringify({
                bdy: {
                    accTkn: accessToken,
                    auth: "READ",
                    devType: 2001,
                    uid: null
                },
                cmd: 100,
                tid: 1,
                ...defaults
            }))
        }
    }, [readyState])

    return (
        <div id="log" className={clsx(small && "small")}>
            {chats.map(chat => {
                const match = chat.message.match(emojiRegex)

                return (
                    <div data-from={chat.nickname}>
                        <span className="meta" style={{
                            color: colors[chat.color]
                        }}>
                            {chat.badges.map(badge => (
                                <img className="badge" src={badge}/>
                            ))}
                            <span className="name">
                                {chat.nickname}
                            </span>
                            <span className="colon">
                                :
                            </span>
                        </span>
                        <span className="message">
                                {match ? (
                                    <Fragment>
                                        {chat.message.split(emojiRegex).map((part, i) => {
                                            if (i % 2 == 0) {
                                                return part
                                            } else {
                                                const src = chat.emojis[part]
                                                return (
                                                    <span className="emote_wrap">
                                                        <img className="emoticon" src={src}/>
                                                    </span>
                                                )
                                            }
                                        })}
                                    </Fragment>
                                ) : (
                                    chat.message
                                )}
                            </span>
                    </div>
                )
            })}
        </div>
    )
}